import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquarePlus, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getStudents, ingestMpesa, formatKES } from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";

export const Route = createFileRoute("/_app/simulate")({
  head: () => ({
    meta: [
      { title: "Simulate M-Pesa · Pocket Track" },
      { name: "description", content: "Test how Pocket Track reads and reconciles M-Pesa deposit messages." },
      { property: "og:title", content: "Simulate M-Pesa · Pocket Track" },
      { property: "og:description", content: "Test M-Pesa reconciliation in Pocket Track." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SimulatePage,
});

function sampleSms(name: string, phone: string, amount: number) {
  const code = Math.random().toString(36).slice(2, 12).toUpperCase();
  const now = new Date();
  const dt = `${now.getDate()}/${now.getMonth() + 1}/${String(now.getFullYear()).slice(2)} at ${now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`;
  return `${code} Confirmed. You have received Ksh${amount.toFixed(2)} from ${name.toUpperCase()} ${phone} on ${dt}. New M-PESA balance is Ksh0.00.`;
}

function SimulatePage() {
  useStoreSync();
  const students = getStudents();
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<
    | { kind: "matched"; name: string; amount: number }
    | { kind: "unmatched"; name: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = ingestMpesa(raw);
    if (res.error) {
      setResult({ kind: "error", message: res.error });
      return;
    }
    if (res.matched && res.student) {
      setResult({ kind: "matched", name: res.student.name, amount: 0 });
      setRaw("");
    } else if (res.unmatched) {
      setResult({ kind: "unmatched", name: res.unmatched.senderName });
      setRaw("");
    }
  }

  function useSample(known: boolean) {
    if (known) {
      const s = students[0];
      if (!s) return;
      setRaw(sampleSms(s.name, `+${s.parentPhone}`, 500));
    } else {
      setRaw(sampleSms("Unknown Sender", "+254700111222", 800));
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Simulate M-Pesa message</h1>
        <p className="text-sm text-muted-foreground mt-1">
          On a real device Pocket Track reads M-Pesa SMS automatically. Here you can paste one manually to test the flow.
        </p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" /> Incoming SMS
          </CardTitle>
          <CardDescription>
            Paste an M-Pesa "money received" confirmation. Matched deposits credit the student instantly; unknown senders wait in the Inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Textarea
              aria-label="M-Pesa confirmation message"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder="ABC12XYZ Confirmed. You have received Ksh500.00 from JANE DOE 254712345678 on 22/7/26..."
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!raw.trim()}>
                <Zap className="h-4 w-4" /> Process message
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => useSample(true)} disabled={students.length === 0}>
                Load known-parent  massage
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => useSample(false)}>
                Load unknown-sender  massage
              </Button>
            </div>
            {result?.kind === "matched" && (
              <div className="rounded-md bg-success/10 text-success text-sm px-3 py-2">
                Matched · credited to <strong>{result.name}</strong>.
              </div>
            )}
            {result?.kind === "unmatched" && (
              <div className="rounded-md bg-accent/30 text-accent-foreground text-sm px-3 py-2">
                No parent matched <strong>{result.name}</strong>. Sent to the M-Pesa Inbox for review.
              </div>
            )}
            {result?.kind === "error" && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {result.message}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered parent phones</CardTitle>
          <CardDescription>Deposits from these numbers match automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students yet — add some in Administration.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {students.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-mono">+{s.parentPhone}</Badge>
                  <span className="truncate">{s.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">{formatKES(s.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
