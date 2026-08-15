-- Pocket Track core financial model
-- V1 scope: incoming pocket-money reconciliation and auditable ledger.

create extension if not exists pgcrypto;

create type public.student_status as enum ('active', 'archived');
create type public.payer_status as enum ('pending', 'verified', 'suspended', 'revoked');
create type public.payment_status as enum ('pending', 'matched', 'review', 'unmatched', 'reversed');
create type public.ledger_entry_type as enum ('credit', 'debit', 'adjustment');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now()
);

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('owner', 'admin', 'teacher', 'viewer')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  class_name text,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, admission_number)
);

create table public.payers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  phone_number text not null,
  relationship text not null default 'other',
  status public.payer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, phone_number)
);

create table public.student_payers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  payer_id uuid not null references public.payers(id) on delete cascade,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, payer_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  external_transaction_id text not null,
  sender_name text,
  sender_phone text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'KES',
  payment_time timestamptz not null,
  raw_message text,
  status public.payment_status not null default 'pending',
  matched_student_id uuid references public.students(id) on delete restrict,
  matched_payer_id uuid references public.payers(id) on delete restrict,
  match_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, external_transaction_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  type public.ledger_entry_type not null,
  amount numeric(14,2) not null check (amount <> 0),
  description text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index students_school_status_idx on public.students(school_id, status);
create index payers_school_phone_idx on public.payers(school_id, phone_number);
create index student_payers_payer_idx on public.student_payers(payer_id);
create index payments_school_status_idx on public.payments(school_id, status, payment_time desc);
create index payments_sender_phone_idx on public.payments(school_id, sender_phone);
create index ledger_student_created_idx on public.ledger_entries(student_id, created_at desc);

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger students_touch_updated_at
before update on public.students
for each row execute function public.touch_updated_at();

create trigger payers_touch_updated_at
before update on public.payers
for each row execute function public.touch_updated_at();

create trigger payments_touch_updated_at
before update on public.payments
for each row execute function public.touch_updated_at();

create or replace function public.student_balance(target_student_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount), 0)::numeric(14,2)
  from public.ledger_entries
  where student_id = target_student_id;
$$;

create or replace function public.match_incoming_payment(payment_id uuid)
returns public.payment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payments%rowtype;
  payer_record public.payers%rowtype;
  candidate_count integer;
  candidate_student uuid;
begin
  select * into p from public.payments where id = payment_id for update;
  if not found then
    raise exception 'payment_not_found';
  end if;

  -- Never process the same payment into the ledger twice.
  if p.status in ('matched', 'reversed') then
    return p.status;
  end if;

  select * into payer_record
  from public.payers
  where school_id = p.school_id
    and public.normalize_phone(phone_number) = public.normalize_phone(p.sender_phone)
    and status = 'verified'
  limit 1;

  if not found then
    update public.payments
      set status = 'unmatched',
          match_reason = 'No verified payer matched the sender phone number'
    where id = payment_id;
    return 'unmatched';
  end if;

  select count(*), min(sp.student_id)
    into candidate_count, candidate_student
  from public.student_payers sp
  join public.students s on s.id = sp.student_id
  where sp.payer_id = payer_record.id
    and s.status = 'active';

  if candidate_count <> 1 then
    update public.payments
      set status = 'review',
          matched_payer_id = payer_record.id,
          match_reason = case
            when candidate_count = 0 then 'Verified payer is not linked to an active student'
            else 'Verified payer is linked to multiple active students'
          end
    where id = payment_id;
    return 'review';
  end if;

  insert into public.ledger_entries (
    school_id, student_id, payment_id, type, amount, description
  ) values (
    p.school_id,
    candidate_student,
    p.id,
    'credit',
    p.amount,
    'Pocket money received from ' || coalesce(p.sender_name, p.sender_phone)
  );

  update public.payments
    set status = 'matched',
        matched_student_id = candidate_student,
        matched_payer_id = payer_record.id,
        match_reason = 'Unique verified payer-to-student match'
  where id = payment_id;

  return 'matched';
end;
$$;

-- RLS is enabled from day one. Policies require a user to be a member of the school.
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.students enable row level security;
alter table public.payers enable row level security;
alter table public.student_payers enable row level security;
alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_members
    where school_id = target_school_id and user_id = auth.uid()
  );
$$;

create policy school_members_can_view_school on public.schools
for select using (public.is_school_member(id));

create policy members_can_view_members on public.school_members
for select using (public.is_school_member(school_id));

create policy members_can_view_students on public.students
for select using (public.is_school_member(school_id));

create policy members_can_manage_students on public.students
for all using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

create policy members_can_view_payers on public.payers
for select using (public.is_school_member(school_id));

create policy members_can_manage_payers on public.payers
for all using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

create policy members_can_view_student_payers on public.student_payers
for select using (
  exists (
    select 1 from public.students s
    where s.id = student_id and public.is_school_member(s.school_id)
  )
);

create policy members_can_manage_student_payers on public.student_payers
for all using (
  exists (
    select 1 from public.students s
    where s.id = student_id and public.is_school_member(s.school_id)
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = student_id and public.is_school_member(s.school_id)
  )
);

create policy members_can_view_payments on public.payments
for select using (public.is_school_member(school_id));

create policy members_can_view_ledger on public.ledger_entries
for select using (public.is_school_member(school_id));

-- Payment ingestion/matching should be moved behind a server-side endpoint later.
-- Do not grant public insert/update permissions on payments or ledger entries.
