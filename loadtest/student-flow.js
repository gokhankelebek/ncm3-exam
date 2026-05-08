// k6 load test: 50 students taking the exam concurrently.
//
// Install k6 (one time):
//   brew install k6
//
// Run from repo root (loads .env automatically via --env flags):
//   k6 run \
//     --env VITE_SUPABASE_URL="$(grep VITE_SUPABASE_URL .env | cut -d= -f2-)" \
//     --env VITE_SUPABASE_ANON_KEY="$(grep VITE_SUPABASE_ANON_KEY .env | cut -d= -f2-)" \
//     loadtest/student-flow.js
//
// Override knobs:
//   --env EXAM_CODE=FORMA-NCM3   exam code to use (default FORMA-NCM3)
//   --env VUS=50                 concurrent students (default 50)
//   --env SAVES=8                save-progress calls per student (default 8)
//   --env THINK_MIN=2            min seconds between saves (default 2)
//   --env THINK_MAX=5            max seconds between saves (default 5)
//   --env DO_SUBMIT=true         set to "false" to skip submit (default true)
//
// Cleanup after a run (in Supabase SQL editor):
//   delete from public.attempts where student_email like 'loadtest+%@example.com';

import http from "k6/http";
import { check, sleep } from "k6";

const SUPA_URL = __ENV.VITE_SUPABASE_URL;
const SUPA_ANON = __ENV.VITE_SUPABASE_ANON_KEY;
const EXAM_CODE = __ENV.EXAM_CODE || "FORMA-NCM3";
const VUS = parseInt(__ENV.VUS || "50", 10);
const SAVES = parseInt(__ENV.SAVES || "8", 10);
const THINK_MIN = parseFloat(__ENV.THINK_MIN || "2");
const THINK_MAX = parseFloat(__ENV.THINK_MAX || "5");
const DO_SUBMIT = (__ENV.DO_SUBMIT || "true").toLowerCase() !== "false";

if (!SUPA_URL || !SUPA_ANON) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. See header of this file for usage."
  );
}

export const options = {
  scenarios: {
    students: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: "10m",
      gracefulStop: "30s",
    },
  },
  // Pass/fail thresholds — tune to your tolerance
  thresholds: {
    http_req_failed: ["rate<0.02"],            // <2% failed requests
    "http_req_duration{name:start-attempt}":  ["p(95)<5000"],
    "http_req_duration{name:save-progress}":  ["p(95)<3000"],
    "http_req_duration{name:submit-attempt}": ["p(95)<8000"],
    checks: ["rate>0.98"],                     // >98% checks pass
  },
};

const HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPA_ANON,
  Authorization: `Bearer ${SUPA_ANON}`,
};

function callFn(name, body) {
  return http.post(
    `${SUPA_URL}/functions/v1/${name}`,
    JSON.stringify(body),
    { headers: HEADERS, tags: { name } }
  );
}

function fakeAnswerFor(q) {
  if (q.t === "mcq") return Math.floor(Math.random() * 4);
  if (q.t === "grid") return String(Math.floor(Math.random() * 100));
  if (q.t === "match") {
    const n = (q.pairs || []).length;
    const order = Array.from({ length: n }, (_, i) => i);
    return { assigns: order.slice(), rightOrder: order, _allCorrect: true };
  }
  if (q.t === "order") {
    const n = (q.items || []).length;
    return Array.from({ length: n }, (_, i) => i);
  }
  return null;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export default function () {
  const studentName = `LoadTest VU${__VU}`;
  const studentEmail = `loadtest+${__VU}@example.com`;

  // 1) start-attempt
  const startRes = callFn("start-attempt", {
    code: EXAM_CODE,
    student_name: studentName,
    student_email: studentEmail,
  });
  const startOk = check(startRes, {
    "start-attempt status 200": (r) => r.status === 200,
    "start-attempt has attempt_id": (r) => {
      try { return !!r.json("attempt_id"); } catch { return false; }
    },
    "start-attempt has questions": (r) => {
      try { return Array.isArray(r.json("exam.questions")); } catch { return false; }
    },
  });
  if (!startOk) {
    console.error(`VU${__VU} start-attempt failed: ${startRes.status} ${startRes.body}`);
    return;
  }

  const data = startRes.json();
  const attempt_id = data.attempt_id;
  const questions = data.exam.questions;

  // 2) Periodic save-progress, accumulating answers each round
  const answers = {};
  const flags = [];
  const perRound = Math.max(1, Math.ceil(questions.length / SAVES));

  for (let s = 0; s < SAVES; s++) {
    for (let k = 0; k < perRound; k++) {
      const qi = s * perRound + k;
      if (qi >= questions.length) break;
      const q = questions[qi];
      answers[q.i] = fakeAnswerFor(q);
    }
    const saveRes = callFn("save-progress", {
      attempt_id,
      answers,
      flags,
      events: [
        {
          question_id: questions[Math.min(s, questions.length - 1)].i,
          event_type: "view",
          payload: { at: Date.now() },
        },
      ],
    });
    check(saveRes, { "save-progress status 200": (r) => r.status === 200 });
    sleep(rand(THINK_MIN, THINK_MAX));
  }

  // 3) submit-attempt
  if (DO_SUBMIT) {
    const submitRes = callFn("submit-attempt", { attempt_id });
    check(submitRes, {
      "submit-attempt status 200": (r) => r.status === 200,
      "submit-attempt returns score": (r) => {
        try { return typeof r.json("score") === "number" || typeof r.json("pct") === "number"; }
        catch { return false; }
      },
    });
  }
}
