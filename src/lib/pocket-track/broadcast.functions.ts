import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const inputSchema = z.object({
  template: z.string().min(1).max(1000),
  from: z.string().min(5).max(30),
  studentIds: z.array(z.string().uuid()).min(1).max(500),
});

export function fillTemplate(
  template: string,
  student: { name: string; className: string; admissionNo: string; balance: number },
): string {
  return template
    .replace(/\{name\}/gi, student.name)
    .replace(/\{class\}/gi, student.className)
    .replace(/\{admission\}/gi, student.admissionNo)
    .replace(/\{balance\}/gi, `KES ${student.balance.toLocaleString("en-KE")}`);
}

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const twilioKey = process.env["TWILIO_API_KEY"];
    if (!lovableKey || !twilioKey) {
      return {
        ok: false as const,
        error: "SMS sending is not set up yet. Link your Twilio account in the project settings first.",
      };
    }

    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("students")
      .select("id, name, class_name, admission_no, parent_phone, balance")
      .in("id", data.studentIds);
    if (error) return { ok: false as const, error: error.message };

    const students = (rows ?? []).filter((r) => r.parent_phone);
    if (students.length === 0) return { ok: false as const, error: "No parent phone numbers to send to." };

    const { data: broadcast, error: bErr } = await supabase
      .from("broadcasts")
      .insert({ user_id: userId, template: data.template })
      .select("id")
      .single();
    if (bErr || !broadcast) return { ok: false as const, error: bErr?.message ?? "Could not save broadcast." };

    let sent = 0;
    let failed = 0;
    const recipients: {
      broadcast_id: string;
      user_id: string;
      student_id: string;
      student_name: string;
      phone: string;
      body: string;
      status: string;
      error: string | null;
    }[] = [];

    for (const s of students) {
      const body = fillTemplate(data.template, {
        name: s.name,
        className: s.class_name,
        admissionNo: s.admission_no,
        balance: Number(s.balance),
      });
      const to = s.parent_phone.startsWith("+") ? s.parent_phone : `+${s.parent_phone}`;

      let status = "sent";
      let errText: string | null = null;
      try {
        const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": twilioKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: data.from, Body: body }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`Twilio send failed [${res.status}]: ${text}`);
          status = "failed";
          errText = `[${res.status}] ${text.slice(0, 300)}`;
        }
      } catch (e) {
        status = "failed";
        errText = e instanceof Error ? e.message : "Unknown error";
      }

      if (status === "sent") sent += 1;
      else failed += 1;

      recipients.push({
        broadcast_id: broadcast.id,
        user_id: userId,
        student_id: s.id,
        student_name: s.name,
        phone: to,
        body,
        status,
        error: errText,
      });
    }

    await supabase.from("broadcast_recipients").insert(recipients);
    await supabase.from("broadcasts").update({ sent_count: sent, failed_count: failed }).eq("id", broadcast.id);

    return { ok: true as const, sent, failed };
  });
