import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Send, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useStoreSync } from "@/lib/pocket-track/use-store";
import { getStudents, formatKES } from "@/lib/pocket-track/store";
import { supabase } from "@/integrations/supabase/client";
import { sendBroadcast, fillTemplate } from "@/lib/pocket-track/broadcast.functions";

export const Route = createFileRoute("/_app/broadcast")({
  head: () => ({
    meta: [
      { title: "SMS broadcast · Pocket Track" },
      {
        name: "description",
        content:
          "Send one personalised SMS to every linked parent, with each child's name and current pocket-money balance filled in.",
      },
      { property: "og:title", content: "SMS broadcast · Pocket Track" },
      {
        property: "og:description",
        content: "Text all linked parents at once, personalised per student, and keep a record of every send.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BroadcastPage,
});

const FROM_KEY = "pt.smsFrom";
const DEFAULT_TEMPLATE =
  "Dear parent, {name} ({class}) currently has {balance} in pocket money. Thank you. - Pocket Track";

type HistoryRow = {
  id: string;
  template: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

function BroadcastPage() {
  useStoreSync();
  const students = getStudents();
  const send = useServerFn(sendBroadcast);

  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [from, setFrom] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState("all");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    setFrom(localStorage.getItem(FROM_KEY) ?? "");
    void loadHistory();
  }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from("broadcasts")
      .select("id, template, sent_count, failed_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []) as HistoryRow[]);
  }

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.className))).sort(),
    [students],
  );

  const withPhone = students.filter((s) => s.parentPhone);
  const visible = withPhone.filter((s) => classFilter === "all" || s.className === classFilter);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  const preview = useMemo(() => {
    const first = visible.find((s) => selected.has(s.id)) ?? visible[0];
    if (!first) return "";
    return fillTemplate(template, first);
  }, [template, visible, selected]);

  async function onSend() {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("Choose at least one parent to text.");
      return;
    }
    if (!from.trim()) {
      toast.error("Enter the sender number or sender ID your SMS account uses.");
      return;
    }
    if (!template.trim()) {
      toast.error("Write the message first.");
      return;
    }
    setSending(true);
    try {
      localStorage.setItem(FROM_KEY, from.trim());
      const result = await send({ data: { template: template.trim(), from: from.trim(), studentIds: ids } });
      if (!result.ok) toast.error(result.error);
      else if (result.failed > 0)
        toast.warning(`Sent to ${result.sent} parent(s), ${result.failed} failed.`);
      else toast.success(`Sent to ${result.sent} parent(s).`);
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the messages.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> SMS broadcast
        </h1>
        <p className="text-muted-foreground mt-1">
          Text linked parents directly from Pocket Track. Each message is personalised with that child's
          name, class and current balance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>
              Use {"{"}name{"}"}, {"{"}class{"}"}, {"{"}admission{"}"} and {"{"}balance{"}"} — they are
              replaced for each parent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-from">Sender number or sender ID</Label>
              <Input
                id="bc-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="+254700000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-template">Message text</Label>
              <Textarea
                id="bc-template"
                rows={5}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </div>
            {preview ? (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Preview</div>
                {preview}
              </div>
            ) : null}
            <Button onClick={onSend} disabled={sending} className="w-full">
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : `Send to ${selected.size} parent${selected.size === 1 ? "" : "s"}`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parents</CardTitle>
            <CardDescription>Only students with a linked parent phone are listed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={classFilter === "all" ? "secondary" : "ghost"}
                onClick={() => setClassFilter("all")}
              >
                All classes
              </Button>
              {classes.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={classFilter === c ? "secondary" : "ghost"}
                  onClick={() => setClassFilter(c)}
                >
                  {c}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-b pb-2">
              <Checkbox
                id="bc-all"
                checked={allVisibleSelected}
                onCheckedChange={(checked) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const s of visible) {
                      if (checked) next.add(s.id);
                      else next.delete(s.id);
                    }
                    return next;
                  })
                }
              />
              <Label htmlFor="bc-all" className="text-sm">
                Select all shown ({visible.length})
              </Label>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y">
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No students with a parent phone yet. Add them under Administration.
                </p>
              ) : (
                visible.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                    <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.className} · {s.parentPhone}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">{formatKES(s.balance)}</span>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past broadcasts</CardTitle>
          <CardDescription>What was sent, when, and to how many parents.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y">
              {history.map((h) => (
                <li key={h.id} className="py-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("en-KE")}
                    </span>
                    <Badge variant="secondary">{h.sent_count} sent</Badge>
                    {h.failed_count > 0 ? <Badge variant="destructive">{h.failed_count} failed</Badge> : null}
                  </div>
                  <p className="text-sm">{h.template}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
