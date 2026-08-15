import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "app_overview",
  title: "Pocket Track overview",
  description:
    "Describe what Pocket Track does, the screens a teacher can use, and how M-Pesa deposits are reconciled to students.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const overview = {
      name: "Pocket Track",
      purpose:
        "Lets a class teacher track each student's pocket money balance and disbursements without ever holding or moving the money itself.",
      screens: [
        { path: "/dashboard", what: "All students with balances and quick stats." },
        { path: "/students/:id", what: "One student's profile and full disbursement history." },
        { path: "/admin", what: "Register students: admission number, name, class, parent phone." },
        { path: "/bulk", what: "Record disbursements for many students at once." },
        { path: "/mpesa", what: "Deposits from phone numbers not linked to any student." },
        { path: "/simulate", what: "Paste a sample M-Pesa message to test reconciliation." },
      ],
      reconciliation:
        "An M-Pesa deposit is matched to a student by the sender's phone number against the parent phone on record. Unmatched deposits are parked for the teacher to place manually; money is never touched by the app.",
      dataLocation:
        "Student records currently live in the teacher's own browser storage, so they are not readable through this MCP server.",
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(overview, null, 2) }],
      structuredContent: overview,
    };
  },
});
