// =============================================================
//  api.js — Supabase client + edge function wrappers
// =============================================================
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPA_URL || !SUPA_ANON) {
  // Surface this clearly in dev — most likely .env wasn't set up.
  // eslint-disable-next-line no-console
  console.error(
    "[ncm3] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(SUPA_URL, SUPA_ANON);

// ----- Student-facing edge functions -----

export async function startAttempt({ code, student_name, student_email }) {
  const { data, error } = await supabase.functions.invoke("start-attempt", {
    body: { code, student_name, student_email },
  });
  if (error) throw new Error(extractError(error, data));
  return data;
}

export async function saveProgress({ attempt_id, answers, flags, events }) {
  const { data, error } = await supabase.functions.invoke("save-progress", {
    body: { attempt_id, answers, flags, events },
  });
  if (error) throw new Error(extractError(error, data));
  return data;
}

export async function submitAttempt({ attempt_id }) {
  const { data, error } = await supabase.functions.invoke("submit-attempt", {
    body: { attempt_id },
  });
  if (error) throw new Error(extractError(error, data));
  return data;
}

// ----- Teacher-facing PostgREST queries (RLS-scoped) -----

export async function listAttempts({ exam_id }) {
  let q = supabase
    .from("attempts")
    .select(
      "id, exam_id, exam_code_id, student_name, student_email, class_period," +
        " answers, score, total, pct, domain_breakdown, dok_breakdown, per_question," +
        " started_at, submitted_at, duration_seconds"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (exam_id) q = q.eq("exam_id", exam_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listExams() {
  const { data, error } = await supabase
    .from("exams")
    .select("id, title, suggested_minutes, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getExamPublic(exam_id) {
  // The exams_public view strips answer keys.
  const { data, error } = await supabase
    .from("exams_public")
    .select("*")
    .eq("id", exam_id)
    .single();
  if (error) throw error;
  return data;
}

// ----- Auth helpers -----

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ----- Local resume support (sessionStorage; survives reload, not tab close) -----

const SESSION_KEY = "ncm3.session";

export function saveLocalSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function loadLocalSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

// ----- helpers -----

function extractError(error, data) {
  if (data && typeof data === "object" && "error" in data) {
    return String(data.error);
  }
  return error?.message || "Unknown error";
}
