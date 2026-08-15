import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  if (digits.length === 9) return "+254" + digits;
  return "+" + digits;
}

export default defineTool({
  name: "parse_mpesa_message",
  title: "Parse M-Pesa message",
  description:
    "Read a raw M-Pesa confirmation SMS and extract the transaction code, amount in KES, sender name and normalised sender phone number. Read-only: it never moves money and never changes any Pocket Track record.",
  inputSchema: {
    message: z
      .string()
      .describe("The raw M-Pesa confirmation SMS text, exactly as received."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ message }) => {
    const codeMatch = message.match(/\b([A-Z0-9]{8,12})\s+Confirmed/i);
    const amountMatch = message.match(/Ksh\s*([\d,]+(?:\.\d+)?)/i);
    const fromMatch = message.match(/from\s+([A-Z][A-Z\s.'-]+?)\s+(\+?\d[\d\s-]{7,})/i);

    if (!amountMatch || !fromMatch) {
      return {
        content: [
          {
            type: "text" as const,
            text: "This does not look like an M-Pesa confirmation message — no amount and sender could be read.",
          },
        ],
        isError: true,
      };
    }

    const parsed = {
      mpesaCode: codeMatch?.[1]?.toUpperCase() ?? "UNKNOWN",
      amount: parseFloat(amountMatch[1].replace(/,/g, "")),
      senderName: fromMatch[1].trim().replace(/\s+/g, " "),
      senderPhone: normalizePhone(fromMatch[2]),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      structuredContent: parsed,
    };
  },
});
