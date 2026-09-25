import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Phone, Hash, GraduationCap, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getStudent,
  getStudentDisbursements,
  recordWithdrawal,
  deleteStudent,
  formatKES,
} from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";

export const Route = createFileRoute("/_app/students/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Student · Pocket Track` },
      { name: "description", content: `Pocket money history and disbursements for student ${params.id}.` },
      { property: "og:title", content: "Student · Pocket Track" },
      { property: "og:description", content: "Pocket money history and disbursements." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentPage,
});

function StudentPage() {
  useStoreSync();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const student = getStudent(id);
  if (!student) throw notFound();
  const records = getStudentDisbursements(student.id);

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to student list
      </Link>

      <Card className="shadow-soft overflow-hidden">
        <div className="bg-brand-gradient text-primary-foreground p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm opacity-80">{student.className}</div>
              <h1 className="text-3xl font-semibold tracking-tight mt-1">{student.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">Current balance</div>
              <div className="text-3xl font-semibold tracking-tight">{formatKES(student.balance)}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-6 grid gap-4 sm:grid-cols-3">
          <Info icon={Hash} label="Admission" value={student.admissionNo} />
          <Info icon={GraduationCap} label="Class" value={student.className} />
          <Info icon={Phone} label="Parent phone" value={`+${student.parentPhone}`} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <WithdrawDialog studentId={student.id} maxAmount={student.balance} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="h-4 w-4" /> Remove student
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {student.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the student and all their disbursement records from this device. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  deleteStudent(student.id);
                  navigate({ to: "/students" });
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Disbursement history</h2>
        {records.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No records yet. Deposits appear here automatically when the parent sends M-Pesa.
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-soft">
            <ul className="divide-y">
              {records.map((r) => (
                <li key={r.id} className="p-4 flex items-center gap-4">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      r.type === "deposit"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {r.type === "deposit" ? (
                      <ArrowDownRight className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.note}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{new Date(r.createdAt).toLocaleString("en-KE")}</span>
                      {r.source && <Badge variant="outline" className="font-mono text-[10px]">{r.source}</Badge>}
                    </div>
                  </div>
                  <div
                    className={`font-semibold tabular-nums ${
                      r.type === "deposit" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {r.type === "deposit" ? "+" : "−"}
                    {formatKES(r.amount)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-md bg-secondary text-primary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function WithdrawDialog({ studentId, maxAmount }: { studentId: string; maxAmount: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return setErr("Enter a valid amount");
    if (value > maxAmount) return setErr(`Cannot exceed balance (${formatKES(maxAmount)})`);
    if (!note.trim()) return setErr("Add a short note (e.g. Lunch, Books)");
    recordWithdrawal(studentId, value, note.trim());
    setAmount("");
    setNote("");
    setErr(null);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ArrowUpRight className="h-4 w-4" /> Record disbursement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Record a disbursement</DialogTitle>
            <DialogDescription>
              Log money given to the student. This deducts from their balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input id="amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lunch, textbook, trip fee" rows={2} />
            </div>
            {err && <div className="text-sm text-destructive">{err}</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
