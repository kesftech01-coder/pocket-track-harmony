// Client-side store for Pocket Track MVP (localStorage-backed).
// No backend yet — all data lives in the browser.

export type Student = {
  id: string;
  admissionNo: string;
  name: string;
  className: string;
  parentPhone: string; // normalized, e.g. 2547XXXXXXXX
  balance: number; // KES
};

export type Disbursement = {
  id: string;
  studentId: string;
  type: "deposit" | "withdrawal";
  amount: number;
  note: string;
  source?: string; // e.g. "M-Pesa {code}" or "Manual"
  createdAt: string; // ISO
};

export type UnmatchedMessage = {
  id: string;
  raw: string;
  senderName: string;
  senderPhone: string;
  amount: number;
  mpesaCode: string;
  receivedAt: string;
  resolved: boolean;
};

export type Teacher = {
  name: string;
  className: string;
};

const KEYS = {
  teacher: "pt.teacher",
  students: "pt.students",
  disbursements: "pt.disbursements",
  unmatched: "pt.unmatched",
  password: "pt.password", // extremely mock, do not use for anything real
};

const DEFAULT_PASSWORD = "teacher123";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("pt:change"));
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export function formatKES(n: number): string {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

// ---------- Auth (mock) ----------

export function getTeacher(): Teacher | null {
  return read<Teacher | null>(KEYS.teacher, null);
}

export function signIn(name: string, className: string, password: string): { ok: true } | { ok: false; error: string } {
  const stored = read<string>(KEYS.password, DEFAULT_PASSWORD);
  if (password !== stored) return { ok: false, error: "Incorrect password" };
  if (!name.trim() || !className.trim()) return { ok: false, error: "All fields are required" };
  write<Teacher>(KEYS.teacher, { name: name.trim(), className: className.trim() });
  return { ok: true };
}

export function signOut() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.teacher);
  window.dispatchEvent(new Event("pt:change"));
}

// ---------- Students ----------

export function getStudents(): Student[] {
  return read<Student[]>(KEYS.students, []);
}

export function getStudent(id: string): Student | undefined {
  return getStudents().find((s) => s.id === id);
}

export function addStudent(input: Omit<Student, "id" | "balance"> & { balance?: number }): Student {
  const students = getStudents();
  const student: Student = {
    id: crypto.randomUUID(),
    admissionNo: input.admissionNo.trim(),
    name: input.name.trim(),
    className: input.className.trim(),
    parentPhone: normalizePhone(input.parentPhone),
    balance: input.balance ?? 0,
  };
  write(KEYS.students, [...students, student]);
  return student;
}

export function updateStudent(id: string, patch: Partial<Omit<Student, "id">>) {
  const students = getStudents().map((s) =>
    s.id === id
      ? {
          ...s,
          ...patch,
          parentPhone: patch.parentPhone ? normalizePhone(patch.parentPhone) : s.parentPhone,
        }
      : s,
  );
  write(KEYS.students, students);
}

export function deleteStudent(id: string) {
  write(
    KEYS.students,
    getStudents().filter((s) => s.id !== id),
  );
  write(
    KEYS.disbursements,
    getDisbursements().filter((d) => d.studentId !== id),
  );
}

// ---------- Disbursements ----------

export function getDisbursements(): Disbursement[] {
  return read<Disbursement[]>(KEYS.disbursements, []);
}

export function getStudentDisbursements(studentId: string): Disbursement[] {
  return getDisbursements()
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function pushDisbursement(d: Omit<Disbursement, "id" | "createdAt">) {
  const record: Disbursement = {
    ...d,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const list = getDisbursements();
  write(KEYS.disbursements, [record, ...list]);
  // update balance
  const students = getStudents().map((s) => {
    if (s.id !== d.studentId) return s;
    const delta = d.type === "deposit" ? d.amount : -d.amount;
    return { ...s, balance: Math.max(0, s.balance + delta) };
  });
  write(KEYS.students, students);
  return record;
}

export function recordDeposit(studentId: string, amount: number, note: string, source?: string) {
  return pushDisbursement({ studentId, type: "deposit", amount, note, source });
}

export function recordWithdrawal(studentId: string, amount: number, note: string) {
  return pushDisbursement({ studentId, type: "withdrawal", amount, note, source: "Manual" });
}

export type BulkEntry = { studentId: string; amount: number };

/**
 * Record multiple withdrawals in one atomic write. Validates that every entry
 * has a positive amount and does not exceed the student's current balance
 * before mutating anything — returns { ok: false, errors } otherwise so the
 * caller can show them all at once and no balance is partially updated.
 */
export function recordWithdrawalsBulk(
  entries: BulkEntry[],
  note: string,
): { ok: true; count: number; total: number } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const students = getStudents();
  const byId = new Map(students.map((s) => [s.id, s]));

  const cleaned: BulkEntry[] = [];
  for (const e of entries) {
    const s = byId.get(e.studentId);
    if (!s) {
      errors.push(`Student not found.`);
      continue;
    }
    if (!Number.isFinite(e.amount) || e.amount <= 0) continue; // skip empty rows
    if (e.amount > s.balance) {
      errors.push(`${s.name}: amount exceeds balance (${formatKES(s.balance)}).`);
      continue;
    }
    cleaned.push({ studentId: e.studentId, amount: e.amount });
  }

  if (!note.trim()) errors.push("Add a note for this batch (e.g. Lunch, Trip).");
  if (cleaned.length === 0 && errors.length === 0) errors.push("Enter an amount for at least one student.");
  if (errors.length > 0) return { ok: false, errors };

  const now = new Date().toISOString();
  const newRecords: Disbursement[] = cleaned.map((e) => ({
    id: crypto.randomUUID(),
    studentId: e.studentId,
    type: "withdrawal",
    amount: e.amount,
    note: note.trim(),
    source: "Bulk",
    createdAt: now,
  }));

  const deltaByStudent = new Map<string, number>();
  for (const e of cleaned) {
    deltaByStudent.set(e.studentId, (deltaByStudent.get(e.studentId) ?? 0) + e.amount);
  }

  const updatedStudents = students.map((s) => {
    const delta = deltaByStudent.get(s.id);
    return delta ? { ...s, balance: Math.max(0, s.balance - delta) } : s;
  });

  write(KEYS.disbursements, [...newRecords, ...getDisbursements()]);
  write(KEYS.students, updatedStudents);

  const total = cleaned.reduce((sum, e) => sum + e.amount, 0);
  return { ok: true, count: cleaned.length, total };
}

// ---------- Unmatched M-Pesa messages ----------

export function getUnmatched(): UnmatchedMessage[] {
  return read<UnmatchedMessage[]>(KEYS.unmatched, []).sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  );
}

// Very small parser that mimics an M-Pesa "money received" SMS.
// Expected shape:
// "ABC123XY Confirmed. You have received Ksh500.00 from JANE DOE 254712345678 on 22/7/26 ..."
export function parseMpesa(raw: string): Omit<UnmatchedMessage, "id" | "resolved" | "receivedAt"> | null {
  const codeMatch = raw.match(/\b([A-Z0-9]{8,12})\s+Confirmed/i);
  const amountMatch = raw.match(/Ksh\s*([\d,]+(?:\.\d+)?)/i);
  const fromMatch = raw.match(/from\s+([A-Z][A-Z\s.'-]+?)\s+(\+?\d[\d\s-]{7,})/i);
  if (!amountMatch || !fromMatch) return null;
  return {
    mpesaCode: codeMatch?.[1]?.toUpperCase() ?? "UNKNOWN",
    amount: parseFloat(amountMatch[1].replace(/,/g, "")),
    senderName: fromMatch[1].trim().replace(/\s+/g, " "),
    senderPhone: normalizePhone(fromMatch[2]),
    raw,
  };
}

// Feed an M-Pesa message into the system. If the phone matches a student's
// parent phone, auto-credit. Otherwise, park in unmatched for the teacher.
export function ingestMpesa(raw: string): {
  matched: boolean;
  student?: Student;
  unmatched?: UnmatchedMessage;
  error?: string;
} {
  const parsed = parseMpesa(raw);
  if (!parsed) return { matched: false, error: "Could not read this M-Pesa message." };
  const student = getStudents().find((s) => s.parentPhone === parsed.senderPhone);
  if (student) {
    recordDeposit(
      student.id,
      parsed.amount,
      `From ${parsed.senderName}`,
      `M-Pesa ${parsed.mpesaCode}`,
    );
    return { matched: true, student };
  }
  const record: UnmatchedMessage = {
    ...parsed,
    id: crypto.randomUUID(),
    resolved: false,
    receivedAt: new Date().toISOString(),
  };
  write(KEYS.unmatched, [record, ...read<UnmatchedMessage[]>(KEYS.unmatched, [])]);
  return { matched: false, unmatched: record };
}

export function assignUnmatched(messageId: string, studentId: string) {
  const msg = getUnmatched().find((m) => m.id === messageId);
  if (!msg) return;
  recordDeposit(
    studentId,
    msg.amount,
    `From ${msg.senderName} (manually assigned)`,
    `M-Pesa ${msg.mpesaCode}`,
  );
  const list = read<UnmatchedMessage[]>(KEYS.unmatched, []).map((m) =>
    m.id === messageId ? { ...m, resolved: true } : m,
  );
  write(KEYS.unmatched, list);
}

export function dismissUnmatched(messageId: string) {
  const list = read<UnmatchedMessage[]>(KEYS.unmatched, []).filter((m) => m.id !== messageId);
  write(KEYS.unmatched, list);
}

// ---------- Seed for first run ----------

export function seedIfEmpty() {
  if (getStudents().length > 0) return;
  const seed: Student[] = [
    { id: crypto.randomUUID(), admissionNo: "ADM-1042", name: "Amina Otieno", className: "Grade 6B", parentPhone: "254712345678", balance: 1500 },
    { id: crypto.randomUUID(), admissionNo: "ADM-1043", name: "Brian Kimani", className: "Grade 6B", parentPhone: "254798765432", balance: 250 },
    { id: crypto.randomUUID(), admissionNo: "ADM-1044", name: "Cynthia Wambui", className: "Grade 6B", parentPhone: "254722334455", balance: 3200 },
  ];
  write(KEYS.students, seed);
}
