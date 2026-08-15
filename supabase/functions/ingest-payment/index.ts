import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PaymentInput = {
  schoolId: string;
  externalTransactionId: string;
  senderName?: string;
  senderPhone: string;
  amount: number;
  currency?: string;
  paymentTime?: string;
  rawMessage?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(url, serviceKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let input: PaymentInput;
  try {
    input = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!input.schoolId || !input.externalTransactionId || !input.senderPhone || !Number.isFinite(input.amount) || input.amount <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_payment_input' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: membership } = await adminClient
    .from('school_members')
    .select('id')
    .eq('school_id', input.schoolId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'school_access_denied' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: existing } = await adminClient
    .from('payments')
    .select('id,status')
    .eq('school_id', input.schoolId)
    .eq('external_transaction_id', input.externalTransactionId)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({
      paymentId: existing.id,
      status: existing.status,
      duplicate: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: payment, error: insertError } = await adminClient
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
    .select('id')
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: status, error: matchError } = await adminClient
    .rpc('match_incoming_payment', { payment_id: payment.id });

  if (matchError) {
    return new Response(JSON.stringify({ paymentId: payment.id, status: 'pending', error: matchError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ paymentId: payment.id, status }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
