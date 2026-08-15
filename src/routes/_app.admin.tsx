import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addStudent, getStudents, deleteStudent, normalizePhone } from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";
import { getTeacher } from "@/lib/pocket-track/store";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Administration · Pocket Track" },
      { name: "description", content: "Register new students and manage class records for Pocket Track." },
      { property: "og:title", content: "Administration · Pocket Track" },
      { property: "og:description", content: "Register new students and manage class records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  useStoreSync();
  const teacher = getTeacher();
  const [admissionNo, setAdmissionNo] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState(teacher?.className ?? "");
  const [parentPhone, setParentPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const students = getStudents();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!admissionNo.trim() || !name.trim() || !className.trim() || !parentPhone.trim()) {
      return setErr("All fields are required.");
    }
    const phone = normalizePhone(parentPhone);
    if (phone.length < 12) return setErr("Enter a valid phone number, e.g. 0712345678.");
    if (students.some((s) => s.admissionNo.toLowerCase() === admissionNo.trim().toLowerCase())) {
      return setErr("A student with this admission number already exists.");
    }
    if (students.some((s) => s.parentPhone === phone)) {
      return setErr("This parent phone is already linked to another student.");
    }
    addStudent({ admissionNo, name, className, parentPhone });
    setAdmissionNo("");
    setName("");
    setParentPhone("");
    setOk(`${name.trim()} added successfully.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register new students and manage records for your class.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="shadow-soft h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> New student
            </CardTitle>
            <CardDescription>
              The parent's phone number links their M-Pesa deposits to this student.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adm">Admission number</Label>
                <Input id="adm" value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="ADM-1050" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nm">Student name</Label>
                <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cl">Class</Label>
                <Input id="cl" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Grade 6B" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph">Parent phone</Label>
                <Input id="ph" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="0712 345 678" />
                <p className="text-xs text-muted-foreground">
                  Accepts 07..., 01..., or +2547... formats.
                </p>
              </div>
              {err && <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">{err}</div>}
              {ok && <div className="rounded-md bg-success/10 text-success text-sm px-3 py-2">{ok}</div>}
              <Button type="submit" className="w-full">Add student</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Registered students</CardTitle>
            <CardDescription>{students.length} student{students.length === 1 ? "" : "s"} on record.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {students.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No students yet.</div>
            ) : (
              <ul className="divide-y">
                {students.map((s) => (
                  <li key={s.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        <span className="font-mono">{s.admissionNo}</span>
                        <span>{s.className}</span>
                        <span>+{s.parentPhone}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => {
                        if (confirm(`Remove ${s.name}?`)) deleteStudent(s.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
