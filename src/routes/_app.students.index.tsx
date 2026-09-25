import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getStudents,
  getDisbursements,
  formatKES,
  type Student,
} from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";

export const Route = createFileRoute("/_app/students/")({
  head: () => ({
    meta: [
      { title: "Student list · Pocket Track" },
      {
        name: "description",
        content: "Every registered student with admission number, class, parent phone, balance and disbursement totals.",
      },
      { property: "og:title", content: "Student list · Pocket Track" },
      { property: "og:description", content: "Full student records with balances and disbursement totals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentList,
});

type Row = Student & {
  deposits: number;
  withdrawals: number;
  records: number;
  lastActivity: string | null;
};

function buildRows(students: Student[], disbursments: ReturnType<typeof getDisbursements>): Row[] {
  const byStudent = new Map<string, ReturnType<typeof getDisbursements>>();
  for (const d of disbursments) {
    const list = byStudent.get(d.studentId) ?? [];
    list.push(d);
    byStudent.set(d.studentId, list);
  }
  return students.map((s) => {
    const records = byStudent.get(s.id) ?? [];
    let deposits = 0;
    let withdrawals = 0;
    let last: string | null = null;
    for (const r of records) {
      if (r.type === "deposit") deposits += r.amount;
      else withdrawals += r.amount;
      if (!last || r.createdAt > last) last = r.createdAt;
    }
    return { ...s, deposits, withdrawals, records: records.length, lastActivity: last };
  });
}

function StudentList() {
  useStoreSync();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<string>("all");
  const students = getStudents();
  const disbursements = getDisbursements();
  const rows = useMemo(() => buildRows(students, disbursements), [students, disbursements]);

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.className))).sort(),
    [students],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (cls !== "all" && s.className !== cls) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.admissionNo.toLowerCase().includes(needle) ||
        s.parentPhone.includes(needle.replace(/\D/g, ""))
      );
    });
  }, [rows, q, cls]);

  const totalDeposits = filtered.reduce((sum, s) => sum + s.deposits, 0);
  const totalWithdrawals = filtered.reduce((sum, s) => sum + s.withdrawals, 0);
  const totalBalance = filtered.reduce((sum, s) => sum + s.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Student list</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every registered student with their details and disbursement totals.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search students by name, admission number, or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, admission no, phone..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by class">
          <FilterChip active={cls === "all"} onClick={() => setCls("all")}>
            All ({students.length})
          </FilterChip>
          {classes.map((c) => (
            <FilterChip key={c} active={cls === c} onClick={() => setCls(c)}>
              {c} ({students.filter((s) => s.className === c).length})
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {students.length === 0
                ? "No students yet. Add your first student from the Administration page."
                : "No students match your search or class filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="shadow-soft overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">Student</th>
                    <th scope="col" className="px-4 py-3 font-medium">Admission no.</th>
                    <th scope="col" className="px-4 py-3 font-medium">Class</th>
                    <th scope="col" className="px-4 py-3 font-medium">Parent phone</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Deposits</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Disbursed</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Balance</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link to="/students/$id" params={{ id: s.id }} className="font-medium hover:text-primary transition-colors">
                          {s.name}
                        </Link>
                        {s.lastActivity && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Last activity {new Date(s.lastActivity).toLocaleDateString("en-KE")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.admissionNo}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{s.className}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">+{s.parentPhone}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-success">
                          <ArrowDownRight className="h-3.5 w-3.5" /> {formatKES(s.deposits)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <ArrowUpRight className="h-3.5 w-3.5" /> {formatKES(s.withdrawals)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatKES(s.balance)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/students/$id"
                          params={{ id: s.id }}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`View ${s.records} disbursement records for ${s.name}`}
                        >
                          {s.records} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-semibold">
                    <td className="px-4 py-3" colSpan={4}>
                      {filtered.length} student{filtered.length === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">{formatKES(totalDeposits)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">{formatKES(totalWithdrawals)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKES(totalBalance)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((s) => (
              <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="group block">
                <Card className="shadow-soft hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{s.admissionNo}</div>
                      </div>
                      <Badge variant="outline">{s.className}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">+{s.parentPhone}</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-success/10 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Deposits</div>
                        <div className="text-sm font-semibold text-success tabular-nums">{formatKES(s.deposits)}</div>
                      </div>
                      <div className="rounded-md bg-destructive/10 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Disbursed</div>
                        <div className="text-sm font-semibold text-destructive tabular-nums">{formatKES(s.withdrawals)}</div>
                      </div>
                      <div className="rounded-md bg-secondary py-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</div>
                        <div className="text-sm font-semibold tabular-nums">{formatKES(s.balance)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {s.records} record{s.records === 1 ? "" : "s"}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function downloadCsv(rows: Row[]) {
  const header = "Admission no,Name,Class,Parent phone,Deposits (KES),Disbursed (KES),Balance (KES),Records,Last activity";
  const lines = rows.map((s) =>
    [
      s.admissionNo,
      s.name,
      s.className,
      `+${s.parentPhone}`,
      s.deposits.toFixed(2),
      s.withdrawals.toFixed(2),
      s.balance.toFixed(2),
      s.records,
      s.lastActivity ? new Date(s.lastActivity).toISOString() : "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pocket-track-students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
