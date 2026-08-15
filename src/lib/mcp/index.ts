import { auth, defineMcp } from "@lovable.dev/mcp-js";
import parseMpesaMessageTool from "./tools/parse-mpesa-message";
import appOverviewTool from "./tools/app-overview";

// Must be the direct Supabase host: the published build rewrites SUPABASE_URL to
// a proxy host that fails the RFC 8414 issuer check.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "pocket-track-pro",
  title: "Pocket Track Pro",
  version: "0.1.0",
  instructions:
    "Tools for Pocket Track, a teacher's pocket-money tracker. Use `app_overview` to learn what the app does, and `parse_mpesa_message` to extract the code, amount, sender name and phone from a raw M-Pesa confirmation SMS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [appOverviewTool, parseMpesaMessageTool],
});
