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
 * Inserts a payment notification only. Matching is intentionally performed by
 * the server-side match function so the browser cannot manufacture ledger credits.
 */
export async function ingestPayment(input: PaymentIngestInput) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      school_id: input.schoolId,
      external_transaction_id: input.externalTransactionId,
      sender_name: input.senderName ?? null,
      sender_phone: input.senderPhone,
      amount: input.amount,
      currency: input.currency ?? 'KES',
      payment_time: input.paymentTime ?? new Date().toISOString(),
      raw_message: input.rawMessage ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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
