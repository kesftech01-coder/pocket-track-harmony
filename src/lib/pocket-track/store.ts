// Cloud-backed store for Pocket Track.
// Records live in the Lovable Cloud database, scoped to the signed-in teacher.
// A small in-memory snapshot keeps the UI reads synchronous; every mutation
// writes to the database and then refreshes the snapshot.

import { supabase } from "@/integrations/supabase/client";

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
  source?: string;
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

const TEACHER_KEY = "pt.teacher";

type Snapshot = {
  students: Student[];
  disbursements: Disbursement[];
  unmatched: UnmatchedMessage[];
  loaded: boolean;
};

const snapshot: Snapshot = { students: [], disbursements: [], unmatched: [], loaded: false };

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pt:change"));
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

// ---------- Loading ----------

export async function loadAll(): Promise<void> {
  const [studentsRes, disbRes, unmatchedRes] = await Promise.all([
    supabase.from("students").select("*").order("name"),
    supabase.from("disbursements").select("*").order("created_at", { ascending: false }),
    supabase.from("unmatched_messages").select("*").order("received_at", { ascending: false }),
  ]);

  snapshot.students = (studentsRes.data ?? []).map((r) => ({
    id: r.id,
    admissionNo: r.admission_no,
    name: r.name,
    className: r.class_name,
    parentPhone: r.parent_phone,
    balance: Number(r.balance),
  }));
  snapshot.disbursements = (disbRes.data ?? []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    type: r.type as "deposit" | "withdrawal",
    amount: Number(r.amount),
    note: r.note,
    source: r.source ?? undefined,
    createdAt: r.created_at,
  }));
  snapshot.unmatched = (unmatchedRes.data ?? []).map((r) => ({
    id: r.id,
    raw: r.raw,
    senderName: r.sender_name,
    senderPhone: r.sender_phone,
    amount: Number(r.amount),
    mpesaCode: r.mpesa_code,
    receivedAt: r.received_at,
    resolved: r.resolved,
  }));
  snapshot.loaded = true;
  emit();
}

export function isLoaded(): boolean {
  return snapshot.loaded;
}

// Live updates: incoming forwarded SMS land in the database, so refresh when
// anything the teacher owns changes.
export function subscribeToCloudChanges(): () => void {
  const channel = supabase
    .channel("pt-records")
    .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => void loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "disbursements" }, () => void loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "unmatched_messages" }, () => void loadAll())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---------- Auth ----------

function readTeacher(): Teacher | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TEACHER_KEY);
    return raw ? (JSON.parse(raw) as Teacher) : null;
  } catch {
    return null;
  }
}

export function getTeacher(): Teacher | null {
  return readTeacher();
}

export function setTeacher(name: string, className: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEACHER_KEY, JSON.stringify({ name: name.trim(), className: className.trim() }));
  emit();
}

export async function signInWithEmail(
  email: string,
  className: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!email.trim() || !className.trim() || !password) return { ok: false, error: "All fields are required" };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  const displayName =
    (data.user?.user_metadata?.full_name as string | undefined) ?? data.user?.email ?? "Teacher";
  setTeacher(displayName, className);
  await loadAll();
  return { ok: true };
}

export async function signUpWithEmail(
  email: string,
  className: string,
  password: string,
): Promise<{ ok: true; needsConfirmation: boolean } | { ok: false; error: string }> {
  if (!email.trim() || !className.trim() || !password) return { ok: false, error: "All fields are required" };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth` },
  });
  if (error) return { ok: false, error: error.message };
  if (data.session) {
    setTeacher(data.user?.email ?? "Teacher", className);
    await loadAll();
    return { ok: true, needsConfirmation: false };
  }
  return { ok: true, needsConfirmation: true };
}

export async function signOut() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") localStorage.removeItem(TEACHER_KEY);
  snapshot.students = [];
  snapshot.disbursements = [];
  snapshot.unmatched = [];
  snapshot.loaded = false;
  emit();
}

// ---------- Students ----------

export function getStudents(): Student[] {
  return snapshot.students;
}

export function getStudent(id: string): Student | undefined {
  return snapshot.students.find((s) => s.id === id);
}

export async function addStudent(input: {
  admissionNo: string;
  name: string;
  className: string;
  parentPhone: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Please sign in again." };
  const { error } = await supabase.from("students").insert({
    user_id: userData.user.id,
    admission_no: input.admissionNo.trim(),
    name: input.name.trim(),
    class_name: input.className.trim(),
    parent_phone: normalizePhone(input.parentPhone),
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("students_user_phone_idx")
        ? "This parent phone is already linked to another student."
        : error.message,
    };
  }
  await loadAll();
  return { ok: true };
}

export async function updateStudent(id: string, patch: Partial<Omit<Student, "id" | "balance">>) {
  const row: {
    admission_no?: string;
    name?: string;
    class_name?: string;
    parent_phone?: string;
  } = {};
  if (patch.admissionNo !== undefined) row.admission_no = patch.admissionNo.trim();
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.className !== undefined) row.class_name = patch.className.trim();
  if (patch.parentPhone !== undefined) row.parent_phone = normalizePhone(patch.parentPhone);
  await supabase.from("students").update(row).eq("id", id);
  await loadAll();
}

export async function deleteStudent(id: string) {
  await supabase.from("students").delete().eq("id", id);
  await loadAll();
}

// ---------- Disbursements ----------

export function getDisbursements(): Disbursement[] {
  return snapshot.disbursements;
}

export function getStudentDisbursements(studentId: string): Disbursement[] {
  return snapshot.disbursements
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function recordDeposit(studentId: string, amount: number, note: string, source?: string) {
  const { error } = await supabase.rpc("record_disbursement", {
    p_student_id: studentId,
    p_type: "deposit",
    p_amount: amount,
    p_note: note,
    p_source: source ?? undefined,
  });
  await loadAll();
  if (error) throw new Error(error.message);
}

export async function recordWithdrawal(studentId: string, amount: number, note: string) {
  const { error } = await supabase.rpc("record_disbursement", {
    p_student_id: studentId,
    p_type: "withdrawal",
    p_amount: amount,
    p_note: note,
    p_source: "Manual",
    p_mpesa_code: null,
  });
  await loadAll();
  if (error) throw new Error(error.message);
}

export type BulkEntry = { studentId: string; amount: number };

/**
 * Record multiple withdrawals. Validates every entry against the current
 * balances first and returns all problems at once, so nothing is written
 * unless the whole batch is valid.
 */
export async function recordWithdrawalsBulk(
  entries: BulkEntry[],
  note: string,
): Promise<{ ok: true; count: number; total: number } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const byId = new Map(snapshot.students.map((s) => [s.id, s]));

  const cleaned: BulkEntry[] = [];
  for (const e of entries) {
    const s = byId.get(e.studentId);
    if (!s) {
      errors.push("Student not found.");
      continue;
    }
    if (!Number.isFinite(e.amount) || e.amount <= 0) continue;
    if (e.amount > s.balance) {
      errors.push(`${s.name}: amount exceeds balance (${formatKES(s.balance)}).`);
      continue;
    }
    cleaned.push({ studentId: e.studentId, amount: e.amount });
  }

  if (!note.trim()) errors.push("Add a note for this batch (e.g. Lunch, Trip).");
  if (cleaned.length === 0 && errors.length === 0) errors.push("Enter an amount for at least one student.");
  if (errors.length > 0) return { ok: false, errors };

  const failures: string[] = [];
  for (const e of cleaned) {
    const { error } = await supabase.rpc("record_disbursement", {
      p_student_id: e.studentId,
      p_type: "withdrawal",
      p_amount: e.amount,
      p_note: note.trim(),
      p_source: "Bulk",
      p_mpesa_code: null,
    });
    if (error) failures.push(`${byId.get(e.studentId)?.name ?? "Student"}: ${error.message}`);
  }
  await loadAll();
  if (failures.length > 0) return { ok: false, errors: failures };

  const total = cleaned.reduce((sum, e) => sum + e.amount, 0);
  return { ok: true, count: cleaned.length, total };
}

// ---------- Incoming M-Pesa messages ----------

export function getUnmatched(): UnmatchedMessage[] {
  return snapshot.unmatched;
}

// Parses an M-Pesa "money received" SMS, e.g.
// "ABC123XY Confirmed. You have received Ksh500.00 from JANE DOE 254712345678 on 22/7/26 ..."
export function parseMpesa(
  raw: string,
): Omit<UnmatchedMessage, "id" | "resolved" | "receivedAt"> | null {
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

// Feed an M-Pesa message into the records. Matching parent phone → credited,
// otherwise parked for the teacher to place.
export async function ingestMpesa(raw: string): Promise<{
  matched: boolean;
  student?: Student;
  unmatched?: UnmatchedMessage;
  error?: string;
}> {
  const parsed = parseMpesa(raw);
  if (!parsed) return { matched: false, error: "Could not read this M-Pesa message." };

  const student = snapshot.students.find((s) => s.parentPhone === parsed.senderPhone);
  if (student) {
    const { error } = await supabase.rpc("record_disbursement", {
      p_student_id: student.id,
      p_type: "deposit",
      p_amount: parsed.amount,
      p_note: `From ${parsed.senderName}`,
      p_source: `M-Pesa ${parsed.mpesaCode}`,
      p_mpesa_code: parsed.mpesaCode === "UNKNOWN" ? null : parsed.mpesaCode,
    });
    await loadAll();
    if (error) {
      return {
        matched: false,
        error: error.message.includes("disbursements_user_mpesa_idx")
          ? "This M-Pesa message has already been recorded."
          : error.message,
      };
    }
    return { matched: true, student };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { matched: false, error: "Please sign in again." };
  const { data, error } = await supabase
    .from("unmatched_messages")
    .insert({
      user_id: userData.user.id,
      raw: parsed.raw,
      sender_name: parsed.senderName,
      sender_phone: parsed.senderPhone,
      amount: parsed.amount,
      mpesa_code: parsed.mpesaCode,
    })
    .select()
    .single();
  await loadAll();
  if (error || !data) return { matched: false, error: error?.message ?? "Could not save this message." };
  return {
    matched: false,
    unmatched: {
      id: data.id,
      raw: data.raw,
      senderName: data.sender_name,
      senderPhone: data.sender_phone,
      amount: Number(data.amount),
      mpesaCode: data.mpesa_code,
      receivedAt: data.received_at,
      resolved: data.resolved,
    },
  };
}

export async function assignUnmatched(messageId: string, studentId: string) {
  const { error } = await supabase.rpc("assign_unmatched", {
    p_message_id: messageId,
    p_student_id: studentId,
  });
  await loadAll();
  if (error) throw new Error(error.message);
}

export async function dismissUnmatched(messageId: string) {
  await supabase.from("unmatched_messages").delete().eq("id", messageId);
  await loadAll();
}

// ---------- SMS forwarding token ----------

export async function getIngestToken(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const existing = await supabase.from("sms_ingest_tokens").select("token").maybeSingle();
  if (existing.data?.token) return existing.data.token;
  const created = await supabase
    .from("sms_ingest_tokens")
    .insert({ user_id: userData.user.id })
    .select("token")
    .single();
  return created.data?.token ?? null;
}

export async function resetIngestToken(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  await supabase.from("sms_ingest_tokens").delete().eq("user_id", userData.user.id);
  return getIngestToken();
}
