create extension if not exists pgcrypto;

create type public.payer_relationship as enum ('parent', 'guardian', 'relative', 'sponsor', 'other');
create type public.payer_status as enum ('pending', 'verified', 'suspended', 'revoked');
create type public.payment_status as enum ('pending', 'matched', 'review', 'unmatched', 'reversed');
create type public.ledger_entry_type as enum ('credit', 'debit', 'adjustment');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  class_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (school_id, admission_number)
);

create table public.payers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  phone_number text not null,
  relationship public.payer_relationship not null default 'other',
  status public.payer_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (school_id, phone_number)
);

create table public.student_payers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  payer_id uuid not null references public.payers(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, payer_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  external_transaction_id text not null,
  sender_name text,
  sender_phone text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'KES',
  payment_time timestamptz not null default now(),
  raw_message text,
  status public.payment_status not null default 'pending',
  matched_student_id uuid references public.students(id) on delete restrict,
  matched_payer_id uuid references public.payers(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (school_id, external_transaction_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  type public.ledger_entry_type not null,
  amount numeric(14,2) not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default now()
);

create index students_school_idx on public.students(school_id);
create index payers_school_phone_idx on public.payers(school_id, phone_number);
create index payments_school_status_idx on public.payments(school_id, status);
create index ledger_student_created_idx on public.ledger_entries(student_id, created_at desc);

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g');
$$;

create or replace function public.student_balance(target_student_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(case when type = 'credit' then amount when type = 'debit' then -amount when type = 'adjustment' then amount end), 0)
  from public.ledger_entries
  where student_id = target_student_id;
$$;

create or replace function public.match_pending_payment(target_payment_id uuid)
returns public.payment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payments;
  payer_count integer;
  candidate_count integer;
  matched_payer uuid;
  matched_student uuid;
begin
  select * into p from public.payments where id = target_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;

  if p.status <> 'pending' then return p.status; end if;

  select count(*), min(id) into payer_count, matched_payer
  from public.payers
  where school_id = p.school_id
    and public.normalize_phone(phone_number) = public.normalize_phone(p.sender_phone)
    and status = 'verified';

  if payer_count = 0 then
    update public.payments set status = 'unmatched' where id = p.id;
    return 'unmatched';
  end if;

  select count(*), min(sp.student_id) into candidate_count, matched_student
  from public.student_payers sp
  join public.students s on s.id = sp.student_id
  where sp.payer_id = matched_payer
    and s.school_id = p.school_id
    and s.status = 'active';

  if candidate_count <> 1 then
    update public.payments
      set status = 'review', matched_payer_id = matched_payer
      where id = p.id;
    return 'review';
  end if;

  update public.payments
    set status = 'matched', matched_payer_id = matched_payer, matched_student_id = matched_student
    where id = p.id;

  insert into public.ledger_entries (student_id, payment_id, type, amount, description)
  values (matched_student, p.id, 'credit', p.amount, 'Pocket money received');

  return 'matched';
end;
$$;
