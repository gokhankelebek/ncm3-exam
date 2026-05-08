// get-resume-code — given an attempt_id (UUID), return its resume_code.
// Used right after start-attempt so the student can be shown a code they can
// later use to resume.
//
// Uses the service role key internally to bypass RLS (anon students can't
// read the attempts table directly).

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
    const { attempt_id } = await req.json();
    if (!attempt_id || typeof attempt_id !== "string") {
      return json({ error: "attempt_id required" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await sb
      .from("attempts")
      .select("resume_code, submitted_at")
      .eq("id", attempt_id)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "attempt not found" }, 404);
    if (data.submitted_at) {
      return json({ error: "attempt already submitted" }, 410);
    }

    return json({ resume_code: data.resume_code });
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
