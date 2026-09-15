import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_students",
  title: "List students and balances",
  description:
    "List the signed-in teacher's students with admission number, class, parent phone and current pocket-money balance in KES. Read-only.",
  inputSchema: {
    search: z
      .string()
      .optional()
      .describe("Optional filter matched against student name, admission number or parent phone."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Sign in to Pocket Track to read your students.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id, admission_no, name, class_name, parent_phone, balance")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new ToolError(error.message);

    const term = (search ?? "").trim().toLowerCase();
    const students = (data ?? [])
      .filter(
        (s) =>
          !term ||
          s.name.toLowerCase().includes(term) ||
          s.admission_no.toLowerCase().includes(term) ||
          s.parent_phone.includes(term.replace(/\D/g, "")),
      )
      .map((s) => ({
        id: s.id,
        admissionNo: s.admission_no,
        name: s.name,
        className: s.class_name,
        parentPhone: s.parent_phone,
        balance: Number(s.balance),
      }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ students }, null, 2) }],
      structuredContent: { students },
    };
  },
});
