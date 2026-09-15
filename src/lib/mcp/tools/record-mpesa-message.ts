import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { parseMpesaText } from "@/lib/pocket-track/mpesa-parse";

export default defineTool({
  name: "record_mpesa_message",
  title: "Record an M-Pesa deposit",
  description:
    "Take a raw M-Pesa confirmation SMS and file it in Pocket Track for the signed-in teacher. If the sender's phone matches a student's parent phone, that student's balance is credited; otherwise the message is parked in the teacher's inbox for manual placement. Duplicate transaction codes are ignored.",
  inputSchema: {
    message: z.string().min(10).describe("The raw M-Pesa confirmation SMS text, exactly as received."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ message }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Sign in to Pocket Track to record deposits.");

    const parsed = parseMpesaText(message);
    if (!parsed) throw new ToolError("This does not look like an M-Pesa confirmation message.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("ingest_mpesa_for_user", {
      p_user_id: userId,
      p_raw: parsed.raw,
      p_sender_name: parsed.senderName,
      p_sender_phone: parsed.senderPhone,
      p_amount: parsed.amount,
      p_mpesa_code: parsed.mpesaCode,
    });
    if (error) throw new ToolError(error.message);

    const result = {
      ...(data as Record<string, unknown>),
      amount: parsed.amount,
      senderName: parsed.senderName,
      senderPhone: parsed.senderPhone,
      mpesaCode: parsed.mpesaCode,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
