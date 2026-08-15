import { supabase } from '@/integrations/supabase/client';

export type PaymentIngestInput = {
  schoolId: string;
  externalTransactionId: string;
  senderName?: string;
  senderPhone: string;
  amount: number;
  currency?: string;
  paymentTime?: string;
  rawMessage?: string;
};

export type PaymentStatus = 'pending' | 'matched' | 'review' | 'unmatched' | 'reversed';

/**
 * Payment ingestion is intentionally routed through a server-side Edge Function.
 * Browser clients never receive permission to insert financial records directly.
 */
export async function ingestPayment(input: PaymentIngestInput) {
  const { data, error } = await supabase.functions.invoke('ingest-payment', {
    body: input,
  });

  if (error) throw error;
  return data as { paymentId: string; status: PaymentStatus; duplicate?: boolean };
}

export async function getStudentBalance(studentId: string) {
  const { data, error } = await supabase.rpc('student_balance', {
    target_student_id: studentId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function getStudentLedger(studentId: string) {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getPaymentsForSchool(schoolId: string, status?: PaymentStatus) {
  let query = supabase
    .from('payments')
    .select('*')
    .eq('school_id', schoolId)
    .order('payment_time', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
