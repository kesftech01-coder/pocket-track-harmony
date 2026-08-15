import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Receipt, Search, Users2, Wallet, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStudents,
  recordWithdrawalsBulk,
  formatKES,
  type Student,
} from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";

export const Route = createFileRoute("/_app/bulk")({
  head: () => ({
    meta: [
      { title: "Bulk disbursement · Pocket Track" },
      { name: "description", content: "Record disbursements for multiple students at once and update balances consistently." },
      { property: "og:title", content: "Bulk disbursement · Pocket Track" },
      { property: "og:description", content: "Record multiple students' payments in a single form." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkPage,
});

type Mode = "flat" | "custom";

function BulkPage() {
  useStoreSync();
  const students = getStudents();

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.className));
    return ["all", ...Array.from(set).sort()];
  }, [students]);

  const [classFilter, setClassFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<Mode>("flat");
  const [flatAmount, setFlatAmount] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ count: number; total: number } | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== "all" && s.className !== classFilter) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.admissionNo.toLowerCase().includes(needle)
      );
    });
  }, [students, classFilter, q]);

  const activeStudents = useMemo(() => {
    return visible.filter((s) => selected[s.id]);
  }, [visible, selected]);

  const entries = useMemo(() => {
    return activeStudents.map((s) => {
      const raw = mode === "flat" ? flatAmount : amounts[s.id] ?? "";
      const amount = parseFloat(raw);
      return {
        student: s,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      };
    });
  }, [activeStudents, mode, flatAmount, amounts]);

  const summary = useMemo(() => {
    const valid = entries.filter((e) => e.amount > 0);
    const overdrawn = entries.filter((e) => e.amount > 0 && e.amount > e.student.balance);
    return {
      selectedCount: entries.length,
      chargeableCount: valid.length,
      total: valid.reduce((sum, e) => sum + e.amount, 0),
      overdrawn,
    };
  }, [entries]);

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = { ...selected };
    for (const s of visible) next[s.id] = on;
    setSelected(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSuccess(null);
    const payload = entries
      .filter((entry) => entry.amount > 0)
      .map((entry) => ({ studentId: entry.student.id, amount: entry.amount }));
    const result = recordWithdrawalsBulk(payload, note);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSuccess({ count: result.count, total: result.total });
    setAmounts({});
    setFlatAmount("");
    setSelected({});
    setNote("");
  }

  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected[s.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bulk disbursement</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record a payment for many students in one go — e.g. a class trip, lunch, or exam fee. Balances update together, or not at all.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users2 className="h-4 w-4 text-primary" /> Students
                  </CardTitle>
                  <CardDescription>Pick who this payment applies to.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="w-[180px]" aria-label="Filter students by class">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c === "all" ? "All classes" : c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      aria-label="Search students"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search..."
                      className="pl-9 w-[180px]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Select all {visible.length ? `(${visible.length})` : ""}
                </label>
                {summary.selectedCount > 0 && (
                  <span>{summary.selectedCount} selected</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {students.length === 0 ? "No students registered yet." : "No students match your filter."}
                </div>
              ) : (
                <ul className="divide-y max-h-[520px] overflow-y-auto">
                  {visible.map((s) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      selected={!!selected[s.id]}
                      onToggle={(on) => setSelected((prev) => ({ ...prev, [s.id]: on }))}
                      mode={mode}
                      flatAmount={flatAmount}
                      amount={amounts[s.id] ?? ""}
                      onAmountChange={(v) => setAmounts((prev) => ({ ...prev, [s.id]: v }))}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-32 self-start">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-primary" /> Payment details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Amount mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton active={mode === "flat"} onClick={() => setMode("flat")}>
                    Same for all
                  </ModeButton>
                  <ModeButton active={mode === "custom"} onClick={() => setMode("custom")}>
                    Per student
                  </ModeButton>
                </div>
              </div>

              {mode === "flat" && (
                <div className="space-y-2">
                  <Label htmlFor="flat">Amount per student (KES)</Label>
                  <Input
                    id="flat"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={flatAmount}
                    onChange={(e) => setFlatAmount(e.target.value)}
                    placeholder="200"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Class trip, lunch, exam fee"
                  rows={2}
                />
              </div>

              <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-sm">
                <SummaryRow label="Selected" value={`${summary.selectedCount} student${summary.selectedCount === 1 ? "" : "s"}`} />
                <SummaryRow label="Will be charged" value={`${summary.chargeableCount} student${summary.chargeableCount === 1 ? "" : "s"}`} />
                <div className="flex items-center justify-between pt-1.5 border-t">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Total</span>
                  <span className="font-semibold tabular-nums">{formatKES(summary.total)}</span>
                </div>
              </div>

              {summary.overdrawn.length > 0 && (
                <div className="rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2 space-y-1">
                  <div className="font-medium">Insufficient balance:</div>
                  <ul className="list-disc list-inside">
                    {summary.overdrawn.slice(0, 3).map((e) => (
                      <li key={e.student.id}>
                        {e.student.name} · has {formatKES(e.student.balance)}
                      </li>
                    ))}
                    {summary.overdrawn.length > 3 && <li>and {summary.overdrawn.length - 3} more...</li>}
                  </ul>
                </div>
              )}

              {errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 space-y-1">
                  {errors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}

              {success && (
                <div className="rounded-md bg-success/10 text-success text-sm px-3 py-2 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Recorded {formatKES(success.total)} across {success.count} student{success.count === 1 ? "" : "s"}.</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={summary.chargeableCount === 0 || summary.overdrawn.length > 0}
              >
                Record disbursement
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function StudentRow({
  student,
  selected,
  onToggle,
  mode,
  flatAmount,
  amount,
  onAmountChange,
}: {
  student: Student;
  selected: boolean;
  onToggle: (on: boolean) => void;
  mode: Mode;
  flatAmount: string;
  amount: string;
  onAmountChange: (v: string) => void;
}) {
  const effective = mode === "flat" ? parseFloat(flatAmount) : parseFloat(amount);
  const over = selected && Number.isFinite(effective) && effective > 0 && effective > student.balance;

  return (
    <li className={`flex items-center gap-3 p-3 ${selected ? "bg-secondary/40" : ""}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm">{student.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="font-mono">{student.admissionNo}</span>
          <Badge variant="outline" className="text-[10px] py-0">{student.className}</Badge>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
          Balance
        </div>
        <div className={`text-sm font-medium tabular-nums ${over ? "text-destructive" : ""}`}>
          {formatKES(student.balance)}
        </div>
      </div>
      {mode === "custom" && (
        <Input
          aria-label={`Amount for ${student.name}`}
          type="number"
          min="0"
          inputMode="numeric"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={!selected}
          placeholder="0"
          className="w-24 shrink-0"
        />
      )}
    </li>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm rounded-md border px-3 py-2 transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
