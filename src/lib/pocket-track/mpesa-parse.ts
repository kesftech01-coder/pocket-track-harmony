// Pure M-Pesa SMS parsing. Safe to import from the browser, server routes and
// the MCP tools — it has no database or browser dependencies.

export type ParsedMpesa = {
  raw: string;
  mpesaCode: string;
  amount: number;
  senderName: string;
  senderPhone: string; // normalized, e.g. 2547XXXXXXXX
};

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

// "ABC123XY Confirmed. You have received Ksh500.00 from JANE DOE 254712345678 on 22/7/26 ..."
export function parseMpesaText(raw: string): ParsedMpesa | null {
  const codeMatch = raw.match(/\b([A-Z0-9]{8,12})\s+Confirmed/i);
  const amountMatch = raw.match(/Ksh\s*([\d,]+(?:\.\d+)?)/i);
  const fromMatch = raw.match(/from\s+([A-Z][A-Z\s.'-]+?)\s+(\+?\d[\d\s-]{7,})/i);
  if (!amountMatch || !fromMatch) return null;
  return {
    raw,
    mpesaCode: codeMatch?.[1]?.toUpperCase() ?? "UNKNOWN",
    amount: parseFloat(amountMatch[1].replace(/,/g, "")),
    senderName: fromMatch[1].trim().replace(/\s+/g, " "),
    senderPhone: normalizePhone(fromMatch[2]),
  };
}
