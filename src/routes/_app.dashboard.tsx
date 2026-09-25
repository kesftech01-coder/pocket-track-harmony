import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ArrowRight, TrendingUp, Users2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getStudents,
  getDisbursements,
  getUnmatched,
  formatKES,
} from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Pocket Track" },
      { name: "description", content: "See every student's pocket money balance and recent disbursements at a glance." },
      { property: "og:title", content: "Dashboard · Pocket Track" },
      { property: "og:description", content: "Every student's balance in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  useStoreSync();
  const [q, setQ] = useState("");
  const students = getStudents();
  const disbursements = getDisbursements();
  const unmatched = getUnmatched().filter((m) => !m.resolved);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.admissionNo.toLowerCase().includes(needle) ||
        s.parentPhone.includes(needle) ||
        s.className.toLowerCase().includes(needle),
    );
  }, [q, students]);

  const totalHeld = students.reduce((sum, s) => sum + s.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Balances update automatically when parents send money to your M-Pesa number.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Users2} label="Students" value={students.length.toString()} />
        <StatCard icon={Wallet} label="Total held" value={formatKES(totalHeld)} />
        <StatCard
          icon={TrendingUp}
          label="Disbursements"
          value={disbursements.length.toString()}
          hint={unmatched.length ? `${unmatched.length} unmatched deposit${unmatched.length === 1 ? "" : "s"}` : undefined}
        />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search students by name, admission number, or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, admission no, phone..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {students.length === 0
                ? "No students yet. Add your first student from the Administration page."
                : "No students match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const recent = disbursements.filter((d) => d.studentId === s.id).length;
            return (
              <Link
                key={s.id}
                to="/students/$id"
                params={{ id: s.id }}
                className="group"
              >
                <Card className="shadow-soft hover:border-primary/40 transition-colors h-full">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {s.admissionNo}
                        </div>
                      </div>
                      <Badge variant="outline">{s.className}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Balance</div>
                      <div className="text-2xl font-semibold tracking-tight">
                        {formatKES(s.balance)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>+254{s.parentPhone.slice(3)}</span>
                      <span className="inline-flex items-center gap-1 group-hover:text-primary transition-colors">
                        {recent} record{recent === 1 ? "" : "s"} <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold tracking-tight truncate">{value}</div>
          {hint && <div className="text-xs text-accent-foreground/80 mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
