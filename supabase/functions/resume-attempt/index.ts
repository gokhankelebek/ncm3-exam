// resume-attempt — look up an in-progress attempt by its resume code and
// return the exam (without answer keys), saved answers, and flags so the
// student can continue from a different browser/device.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return json({ error: "code required" }, 400);
    }
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(normalized)) {
      return json({ error: "code must be 8 letters/digits" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: attempt, error: aerr } = await sb
      .from("attempts")
      .select(
        "id, exam_id, started_at, submitted_at, answers, flags," +
        " student_name, student_email"
      )
      .eq("resume_code", normalized)
      .maybeSingle();

    if (aerr) return json({ error: aerr.message }, 500);
    if (!attempt) return json({ error: "code not recognized" }, 404);
    if (attempt.submitted_at) {
      return json({ error: "this attempt has already been submitted" }, 410);
    }

    const { data: exam, error: eerr } = await sb
      .from("exams_public")
      .select("*")
      .eq("id", attempt.exam_id)
      .single();

    if (eerr) return json({ error: eerr.message }, 500);

    return json({
      attempt_id: attempt.id,
      exam,
      started_at: attempt.started_at,
      answers: attempt.answers || {},
      flags: attempt.flags || [],
      student_name: attempt.student_name,
      student_email: attempt.student_email,
    });
  } catch (e) {
    return json({ error: (e as Error).message || "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
