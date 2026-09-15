import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

export const listUnmatchedDeposits = defineTool({
  name: "list_unmatched_deposits",
  title: "List unplaced deposits",
  description:
    "List deposits waiting in the signed-in teacher's inbox because the sender's phone number does not match any student's parent phone. Read-only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Sign in to Pocket Track to read your inbox.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("unmatched_messages")
      .select("id, sender_name, sender_phone, amount, mpesa_code, received_at")
      .eq("user_id", userId)
      .eq("resolved", false)
      .order("received_at", { ascending: false });
    if (error) throw new ToolError(error.message);

    const deposits = (data ?? []).map((m) => ({
      id: m.id,
      senderName: m.sender_name,
      senderPhone: m.sender_phone,
      amount: Number(m.amount),
      mpesaCode: m.mpesa_code,
      receivedAt: m.received_at,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ deposits }, null, 2) }],
      structuredContent: { deposits },
    };
  },
});

export const placeUnmatchedDeposit = defineTool({
  name: "place_unmatched_deposit",
  title: "Place an unplaced deposit",
  description:
    "Credit a waiting deposit from the signed-in teacher's inbox to a specific student, using the deposit id from list_unmatched_deposits and the student id from list_students.",
  inputSchema: {
    depositId: z.string().uuid().describe("Deposit id from list_unmatched_deposits."),
    studentId: z.string().uuid().describe("Student id from list_students."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ depositId, studentId }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Sign in to Pocket Track to place deposits.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: deposit }, { data: student }] = await Promise.all([
      supabaseAdmin
        .from("unmatched_messages")
        .select("id, amount, sender_name, mpesa_code")
        .eq("id", depositId)
        .eq("user_id", userId)
        .eq("resolved", false)
        .maybeSingle(),
      supabaseAdmin
        .from("students")
        .select("id, name")
        .eq("id", studentId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (!deposit) throw new ToolError("That deposit is not in your inbox, or it was already placed.");
    if (!student) throw new ToolError("That student is not in your records.");

    const { error: insertError } = await supabaseAdmin.from("disbursements").insert({
      user_id: userId,
      student_id: student.id,
      type: "deposit",
      amount: deposit.amount,
      note: `From ${deposit.sender_name} (placed by assistant)`,
      source: `M-Pesa ${deposit.mpesa_code}`,
      mpesa_code: deposit.mpesa_code === "UNKNOWN" ? null : deposit.mpesa_code,
    });
    if (insertError) throw new ToolError(insertError.message);

    const { data: current } = await supabaseAdmin
      .from("students")
      .select("balance")
      .eq("id", student.id)
      .single();
    await supabaseAdmin
      .from("students")
      .update({ balance: Number(current?.balance ?? 0) + Number(deposit.amount) })
      .eq("id", student.id)
      .eq("user_id", userId);
    await supabaseAdmin
      .from("unmatched_messages")
      .update({ resolved: true })
      .eq("id", deposit.id)
      .eq("user_id", userId);

    const result = {
      status: "placed",
      studentName: student.name,
      amount: Number(deposit.amount),
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
