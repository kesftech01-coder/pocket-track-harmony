import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Inbox, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getUnmatched,
  getStudents,
  assignUnmatched,
  dismissUnmatched,
  formatKES,
} from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";

export const Route = createFileRoute("/_app/mpesa")({
  head: () => ({
    meta: [
      { title: "M-Pesa Inbox · Pocket Track" },
      { name: "description", content: "Resolve M-Pesa deposits that couldn't be auto-matched to a registered parent." },
      { property: "og:title", content: "M-Pesa Inbox · Pocket Track" },
      { property: "og:description", content: "Resolve unmatched M-Pesa deposits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MpesaInbox,
});

function MpesaInbox() {
  useStoreSync();
  const messages = getUnmatched();
  const students = getStudents();
  const pending = messages.filter((m) => !m.resolved);
  const resolved = messages.filter((m) => m.resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">M-Pesa Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deposits whose sender phone doesn't match a registered parent land here. Assign them to the right student.
        </p>
      </div>

      <div className="rounded-lg border bg-accent/20 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-accent-foreground mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-medium text-accent-foreground">Pocket Track never touches money.</div>
          <div className="text-muted-foreground mt-0.5">
            All funds remain in your M-Pesa account. We only read the SMS confirmation to keep balances up to date.
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Needs action ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Inbox className="h-6 w-6" /> All deposits are matched. Nothing to do.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((m) => (
              <UnmatchedCard
                key={m.id}
                message={m}
                students={students}
              />
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Recently resolved
          </h2>
          <Card>
            <ul className="divide-y">
              {resolved.slice(0, 8).map((m) => (
                <li key={m.id} className="p-3 flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <span className="truncate flex-1">
                    <span className="font-medium">{m.senderName}</span>
                    <span className="text-muted-foreground"> · +{m.senderPhone}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{m.mpesaCode}</span>
                  <span className="font-semibold text-success tabular-nums">{formatKES(m.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function UnmatchedCard({
  message,
  students,
}: {
  message: ReturnType<typeof getUnmatched>[number];
  students: ReturnType<typeof getStudents>;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Card className="shadow-soft border-accent/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {formatKES(message.amount)} from {message.senderName}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap gap-2 items-center">
              <span>+{message.senderPhone}</span>
              <Badge variant="outline" className="font-mono text-[10px]">{message.mpesaCode}</Badge>
              <span className="text-xs">{new Date(message.receivedAt).toLocaleString("en-KE")}</span>
            </CardDescription>
          </div>
          <Badge className="bg-accent text-accent-foreground">Unmatched</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {message.raw}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={selected ?? undefined} onValueChange={setSelected}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[240px]">
              <SelectValue placeholder="Assign to student..." />
            </SelectTrigger>
            <SelectContent>
              {students.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No students registered</div>
              ) : (
                students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.admissionNo}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            disabled={!selected}
            onClick={() => selected && assignUnmatched(message.id, selected)}
          >
            Credit student
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dismissUnmatched(message.id)}>
            <X className="h-4 w-4" /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
