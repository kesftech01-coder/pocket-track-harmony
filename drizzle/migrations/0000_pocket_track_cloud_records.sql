-- Students
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_no text NOT NULL,
  name text NOT NULL,
  class_name text NOT NULL,
  parent_phone text NOT NULL,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX students_user_idx ON public.students(user_id);
CREATE UNIQUE INDEX students_user_phone_idx ON public.students(user_id, parent_phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage their students" ON public.students
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Disbursements
CREATE TABLE public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  source text,
  mpesa_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX disbursements_student_idx ON public.disbursements(student_id, created_at DESC);
CREATE UNIQUE INDEX disbursements_user_mpesa_idx ON public.disbursements(user_id, mpesa_code) WHERE mpesa_code IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disbursements TO authenticated;
GRANT ALL ON public.disbursements TO service_role;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage their disbursements" ON public.disbursements
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Unmatched incoming M-Pesa messages
CREATE TABLE public.unmatched_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  raw text NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  sender_phone text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  mpesa_code text NOT NULL DEFAULT 'UNKNOWN',
  received_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false
);
CREATE INDEX unmatched_user_idx ON public.unmatched_messages(user_id, received_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unmatched_messages TO authenticated;
GRANT ALL ON public.unmatched_messages TO service_role;
ALTER TABLE public.unmatched_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage their unmatched messages" ON public.unmatched_messages
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Per-teacher secret token used by the phone SMS forwarder
CREATE TABLE public.sms_ingest_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.sms_ingest_tokens TO authenticated;
GRANT ALL ON public.sms_ingest_tokens TO service_role;
ALTER TABLE public.sms_ingest_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers see their own ingest token" ON public.sms_ingest_tokens
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Atomic disbursement + balance update, scoped to the caller
CREATE OR REPLACE FUNCTION public.record_disbursement(
  p_student_id uuid,
  p_type text,
  p_amount numeric,
  p_note text DEFAULT '',
  p_source text DEFAULT NULL,
  p_mpesa_code text DEFAULT NULL
) RETURNS public.disbursements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance numeric;
  v_row public.disbursements;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_type NOT IN ('deposit','withdrawal') THEN RAISE EXCEPTION 'Invalid type'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance INTO v_balance FROM public.students
   WHERE id = p_student_id AND user_id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF p_type = 'withdrawal' AND p_amount > v_balance THEN
    RAISE EXCEPTION 'Amount exceeds balance';
  END IF;

  INSERT INTO public.disbursements(user_id, student_id, type, amount, note, source, mpesa_code)
  VALUES (v_user, p_student_id, p_type, p_amount, COALESCE(p_note,''), p_source, p_mpesa_code)
  RETURNING * INTO v_row;

  UPDATE public.students
     SET balance = balance + CASE WHEN p_type = 'deposit' THEN p_amount ELSE -p_amount END
   WHERE id = p_student_id AND user_id = v_user;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_disbursement(uuid, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_disbursement(uuid, text, numeric, text, text, text) TO authenticated;

-- Server-side ingest used by the verified SMS webhook (service role only)
CREATE OR REPLACE FUNCTION public.ingest_mpesa_for_user(
  p_user_id uuid,
  p_raw text,
  p_sender_name text,
  p_sender_phone text,
  p_amount numeric,
  p_mpesa_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students;
BEGIN
  IF p_mpesa_code IS NOT NULL AND p_mpesa_code <> 'UNKNOWN' AND EXISTS (
    SELECT 1 FROM public.disbursements
     WHERE user_id = p_user_id AND mpesa_code = p_mpesa_code
  ) THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;

  SELECT * INTO v_student FROM public.students
   WHERE user_id = p_user_id AND parent_phone = p_sender_phone
   FOR UPDATE;

  IF v_student.id IS NOT NULL THEN
    INSERT INTO public.disbursements(user_id, student_id, type, amount, note, source, mpesa_code)
    VALUES (p_user_id, v_student.id, 'deposit', p_amount,
            'From ' || p_sender_name, 'M-Pesa ' || p_mpesa_code, p_mpesa_code);
    UPDATE public.students SET balance = balance + p_amount WHERE id = v_student.id;
    RETURN jsonb_build_object('status','credited','student_id',v_student.id,'student_name',v_student.name);
  END IF;

  INSERT INTO public.unmatched_messages(user_id, raw, sender_name, sender_phone, amount, mpesa_code)
  VALUES (p_user_id, p_raw, p_sender_name, p_sender_phone, p_amount, COALESCE(p_mpesa_code,'UNKNOWN'));
  RETURN jsonb_build_object('status','unmatched');
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_mpesa_for_user(uuid, text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_mpesa_for_user(uuid, text, text, text, numeric, text) TO service_role;

-- Assign a parked message to a student, in one step
CREATE OR REPLACE FUNCTION public.assign_unmatched(p_message_id uuid, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.unmatched_messages;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_msg FROM public.unmatched_messages
   WHERE id = p_message_id AND user_id = v_user AND resolved = false FOR UPDATE;
  IF v_msg.id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;

  PERFORM public.record_disbursement(
    p_student_id, 'deposit', v_msg.amount,
    'From ' || v_msg.sender_name || ' (manually assigned)',
    'M-Pesa ' || v_msg.mpesa_code, v_msg.mpesa_code);

  UPDATE public.unmatched_messages SET resolved = true WHERE id = p_message_id;
  RETURN jsonb_build_object('status','assigned');
END;
$$;

REVOKE ALL ON FUNCTION public.assign_unmatched(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_unmatched(uuid, uuid) TO authenticated;