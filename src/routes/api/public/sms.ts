// Endpoint an SMS-forwarding app on the teacher's phone posts each M-Pesa
// message to. Authenticated by the teacher's own secret forwarding token.
//
//   POST /api/public/sms
//   { "token": "<secret>", "message": "<raw M-Pesa SMS>" }
//
// A matching parent phone credits the student instantly; anything else is
// parked in the teacher's inbox for manual placement.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { parseMpesaText } from "@/lib/pocket-track/mpesa-parse";

const bodySchema = z.object({
  token: z.string().min(10).optional(),
  message: z.string().min(10),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsedBody: unknown;
        try {
          parsedBody = await request.json();
        } catch {
          return json({ error: "Expected a JSON body." }, 400);
        }

        const result = bodySchema.safeParse(parsedBody);
        if (!result.success) return json({ error: "Provide token and message." }, 400);

        const token = result.data.token ?? request.headers.get("x-pocket-track-token") ?? "";
        if (token.length < 10) return json({ error: "Missing forwarding token." }, 401);

        const parsed = parseMpesaText(result.data.message);
        if (!parsed) return json({ error: "Not an M-Pesa confirmation message." }, 422);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tokenRow } = await supabaseAdmin
          .from("sms_ingest_tokens")
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (!tokenRow) return json({ error: "Invalid forwarding token." }, 401);

        const { data, error } = await supabaseAdmin.rpc("ingest_mpesa_for_user", {
          p_user_id: tokenRow.user_id,
          p_raw: parsed.raw,
          p_sender_name: parsed.senderName,
          p_sender_phone: parsed.senderPhone,
          p_amount: parsed.amount,
          p_mpesa_code: parsed.mpesaCode,
        });
        if (error) return json({ error: error.message }, 500);

        return json(data ?? { status: "ok" });
      },
    },
  },
});
