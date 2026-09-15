import { auth, defineMcp } from "@lovable.dev/mcp-js";
import parseMpesaMessageTool from "./tools/parse-mpesa-message";
import appOverviewTool from "./tools/app-overview";
import listStudentsTool from "./tools/list-students";
import recordMpesaMessageTool from "./tools/record-mpesa-message";
import { listUnmatchedDeposits, placeUnmatchedDeposit } from "./tools/unmatched-deposits";

// Must be the direct Supabase host: the published build rewrites SUPABASE_URL to
// a proxy host that fails the RFC 8414 issuer check.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "pocket-track-pro",
  title: "Pocket Track Pro",
  version: "0.1.0",
  instructions:
    "Tools for Pocket Track, a teacher's pocket-money tracker. `app_overview` explains the app. `parse_mpesa_message` reads a raw M-Pesa SMS without saving anything. `list_students` shows the signed-in teacher's students and balances. `record_mpesa_message` files a real M-Pesa SMS: it credits the matching student or parks the deposit in the inbox. `list_unmatched_deposits` and `place_unmatched_deposit` handle deposits whose sender is not linked to a student.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    appOverviewTool,
    parseMpesaMessageTool,
    listStudentsTool,
    recordMpesaMessageTool,
    listUnmatchedDeposits,
    placeUnmatchedDeposit,
  ],
});
