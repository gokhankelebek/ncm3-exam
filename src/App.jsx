import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  T, lbl, inpt, primaryBtn, navBtn, btnTiny, panel, panelHead,
  DOMAIN_NAMES, DOMAIN_COLORS,
} from "./tokens.js";
import { Stem } from "./math.jsx";
import { F } from "./figures.jsx";
import { MCQItem, GridItem, MatchItem, OrderItem } from "./items.jsx";
import { CalculatorPanel } from "./calculator.jsx";
import {
  startAttempt, saveProgress, submitAttempt,
  listAttempts, getExamPublic, signIn, signOut, getSession, onAuthStateChange,
  saveLocalSession, loadLocalSession, clearLocalSession,
} from "./api.js";

// Detect mobile/tablet width for responsive layout decisions
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

// Lightweight sessionStorage-backed state (used for client-only data like
// MCQ choice eliminations that don't need to round-trip the server).
function useSessionState(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV];
}

// =============================================================
//  HEADER
// =============================================================
function Header() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "20px 0 8px", borderBottom: `1px solid ${T.rule}`, marginBottom: 24 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", color: T.ink, fontVariationSettings: '"opsz" 144' }}>
        NC Math 3
      </div>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: T.ink3, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        EOC Mock
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 13, color: T.ink3 }}>tmsa</div>
    </div>
  );
}

// =============================================================
//  LANDING — student or teacher entry point
// =============================================================
function Landing({ onStarted, onTeacher }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!c) { setErr("Please enter the exam code."); return; }
    if (!name.trim()) { setErr("Please enter your name."); return; }
    setBusy(true);
    try {
      const result = await startAttempt({
        code: c,
        student_name: name.trim(),
        student_email: email.trim() || undefined,
      });
      onStarted({ ...result, student_name: name.trim(), student_email: email.trim() || null });
    } catch (e) {
      setErr(e.message || "Could not start exam.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Header />
      <div style={{ padding: "36px 0 24px" }}>
        <div style={{
          fontFamily: "Fraunces, serif", fontSize: 56, lineHeight: 1.05,
          fontWeight: 400, letterSpacing: "-0.02em", color: T.ink,
          fontVariationSettings: '"opsz" 144, "SOFT" 30', marginBottom: 16,
        }}>
          Enter exam code<br />
          <em style={{ color: T.saffron }}>to begin.</em>
        </div>
        <p style={{ fontFamily: "Bricolage Grotesque", fontSize: 15, color: T.ink2, lineHeight: 1.65, maxWidth: 520 }}>
          Your work is saved automatically as you go. You can close the tab and return to the same browser to resume. The honor code applies.
        </p>

        <div style={{ marginTop: 28, display: "grid", gap: 12, maxWidth: 420 }}>
          <label style={lbl}>
            <span>Your name</span>
            <input style={inpt} value={name} onChange={(e) => setName(e.target.value)} placeholder="Last, First" disabled={busy} />
          </label>
          <label style={lbl}>
            <span>Email <span style={{ color: T.ink3 }}>(optional, for your records)</span></span>
            <input style={inpt} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" disabled={busy} type="email" />
          </label>
          <label style={lbl}>
            <span>Exam code</span>
            <input
              style={{ ...inpt, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }}
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FORMA-NCM3" disabled={busy}
            />
          </label>
          {err && <div style={{ color: T.oxblood, fontSize: 13, fontFamily: "Bricolage Grotesque" }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Loading…" : "Start exam →"}
          </button>
        </div>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${T.rule}`, fontSize: 12, color: T.ink3 }}>
          <button onClick={onTeacher} style={{ background: "none", border: "none", color: T.ink3, fontFamily: "Bricolage Grotesque", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Teacher login →
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
//  useAttemptManager — handles answers, debounced auto-save, events
// =============================================================
function useAttemptManager(initial) {
  // initial = { attempt_id, exam, started_at }
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const eventQueueRef = useRef([]);
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);

  // Persist locally so a refresh resumes where you left off (same browser)
  useEffect(() => {
    saveLocalSession({
      attempt_id: initial.attempt_id,
      exam: initial.exam,
      started_at: initial.started_at,
      answers,
      flags,
    });
  }, [initial, answers, flags]);

  const flushSave = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaving(true);
    setSaveError(null);
    const events = eventQueueRef.current;
    eventQueueRef.current = [];
    try {
      await saveProgress({
        attempt_id: initial.attempt_id,
        answers, flags,
        events: events.length ? events : undefined,
      });
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveError(e.message || "save failed");
      // re-queue events on failure so they aren't lost
      eventQueueRef.current = [...events, ...eventQueueRef.current];
      dirtyRef.current = true;
    } finally {
      setSaving(false);
    }
  }, [initial.attempt_id, answers, flags]);

  // Debounced save on answer/flag change
  useEffect(() => {
    if (!dirtyRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { flushSave(); }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [answers, flags, flushSave]);

  // Save on page hide (best-effort)
  useEffect(() => {
    const onHide = () => { if (dirtyRef.current) flushSave(); };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [flushSave]);

  const setAnswer = (qid, val) => {
    setAnswers((prev) => {
      const old = prev[qid];
      const next = { ...prev, [qid]: val };
      dirtyRef.current = true;
      eventQueueRef.current.push({
        question_id: qid,
        event_type: "answer_change",
        payload: { from: old ?? null, to: val ?? null },
      });
      return next;
    });
  };

  const toggleFlag = (qid) => {
    setFlags((prev) => {
      const set = new Set(prev);
      const wasFlagged = set.has(qid);
      if (wasFlagged) set.delete(qid); else set.add(qid);
      dirtyRef.current = true;
      eventQueueRef.current.push({
        question_id: qid,
        event_type: wasFlagged ? "unflag" : "flag",
      });
      return [...set];
    });
  };

  const trackView = (qid) => {
    eventQueueRef.current.push({
      question_id: qid,
      event_type: "view",
      payload: { at: Date.now() },
    });
    dirtyRef.current = true;
  };

  return {
    answers, flags,
    setAnswer, toggleFlag, trackView,
    flushSave,
    saving, lastSavedAt, saveError,
  };
}

// =============================================================
//  TEST SCREEN
// =============================================================
function TestScreen({ session, onSubmitDone, onError }) {
  const { exam, attempt_id, started_at, student_name } = session;
  const QS = exam.questions;
  const mgr = useAttemptManager(session);
  const isMobile = useIsMobile();
  const [idx, setIdx] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [navOpen, setNavOpen] = useState(false);   // mobile drawer
  const [calcOpen, setCalcOpen] = useState(false);

  // Per-question MCQ choice eliminations (client-only, sessionStorage-backed)
  const [eliminations, setEliminations] = useSessionState(
    `ncm3.elim.${attempt_id}`,
    {}
  );
  const toggleEliminate = (qid, choiceIdx) => {
    setEliminations((prev) => {
      const cur = prev[qid] || [];
      const next = cur.includes(choiceIdx)
        ? cur.filter((x) => x !== choiceIdx)
        : [...cur, choiceIdx];
      return { ...prev, [qid]: next };
    });
  };

  const q = QS[idx];
  const total = QS.length;
  const isAnswered = (qq) => {
    const a = mgr.answers[qq.i];
    if (a == null || a === "") return false;
    if (qq.t === "match") return a.assigns && a.assigns.every((x) => x >= 0);
    return true;
  };
  const answered = QS.filter(isAnswered).length;
  const unansweredIds = QS.filter((qq) => !isAnswered(qq)).map((qq) => qq.i);
  const flaggedIds = mgr.flags.slice().sort((a, b) => a - b);

  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(started_at).getTime()) / 1000)
  );
  useEffect(() => {
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - new Date(started_at).getTime()) / 1000)),
      1000
    );
    return () => clearInterval(t);
  }, [started_at]);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;

  // Track view event when question changes
  useEffect(() => { mgr.trackView(q.i); /* eslint-disable-next-line */ }, [idx]);

  const flagged = mgr.flags.includes(q.i);
  const goTo = (qid) => {
    const j = QS.findIndex((qq) => qq.i === qid);
    if (j >= 0) setIdx(j);
    setNavOpen(false);
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      await mgr.flushSave();
      const result = await submitAttempt({ attempt_id });
      clearLocalSession();
      onSubmitDone(result, session);
    } catch (e) {
      onError(e.message || "Submit failed");
      setSubmitting(false);
    }
  };

  // ----- subcomponents inline -----
  const Navigator = ({ inDrawer = false }) => (
    <div>
      <div style={{
        fontFamily: "Bricolage Grotesque", fontSize: 11, color: T.ink3,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>Navigator</div>
      <div style={{ display: "grid", gridTemplateColumns: inDrawer ? "repeat(8, 1fr)" : "repeat(5, 1fr)", gap: 4 }}>
        {QS.map((qq, j) => {
          const ans = isAnswered(qq);
          const isCur = j === idx;
          const isFlag = mgr.flags.includes(qq.i);
          return (
            <button key={qq.i} onClick={() => { setIdx(j); setNavOpen(false); }}
              style={{
                aspectRatio: "1 / 1",
                border: `1.5px solid ${isCur ? T.ink : ans ? T.saffron : T.rule2}`,
                background: isCur ? T.ink : ans ? T.saffronSoft : "#fff",
                color: isCur ? T.paper : ans ? T.saffronDark : T.ink2,
                fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600,
                borderRadius: 6, cursor: "pointer", position: "relative",
              }} title={qq.s}>
              {qq.i}
              {isFlag && <span style={{ position: "absolute", top: -3, right: -3, color: T.saffron, fontSize: 12 }}>★</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <Header />

      {/* Top bar: identity, save status, timer, answered count, submit, calculator */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.ink2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {student_name}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: mgr.saveError ? T.oxblood : T.ink3 }} title={mgr.saveError || ""}>
          {mgr.saving ? "saving…" : mgr.saveError ? "save error" : mgr.lastSavedAt ? "saved" : ""}
        </div>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: T.ink2 }}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        {!isMobile && (
          <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 13, color: T.ink2 }}>
            {answered} of {total}
          </div>
        )}
        <button
          onClick={() => setCalcOpen((v) => !v)}
          aria-label="Toggle calculator"
          title="Calculator"
          style={{
            ...btnTiny, padding: "6px 10px", fontSize: 13,
            background: calcOpen ? T.saffronSoft : "#fff",
            borderColor: calcOpen ? T.saffron : T.rule2,
            color: calcOpen ? T.saffronDark : T.ink2,
          }}
        >
          ƒ calc
        </button>
        {isMobile && (
          <button onClick={() => setNavOpen(true)} style={{ ...btnTiny, padding: "6px 10px", fontSize: 13 }}>
            {idx + 1}/{total}
          </button>
        )}
        <button onClick={() => setShowSubmit(true)} style={{ ...primaryBtn, marginTop: 0, padding: "8px 16px", fontSize: 13 }}>
          Submit
        </button>
      </div>

      {/* Main grid: question column + (desktop only) navigator rail */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) 200px",
        gap: 24,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{
              fontFamily: "Fraunces, serif", fontSize: isMobile ? 32 : 38, fontWeight: 500, color: T.ink,
              fontVariationSettings: '"opsz" 144', lineHeight: 1,
            }}>
              {idx + 1}<span style={{ color: T.ink3, fontSize: isMobile ? 16 : 18, fontWeight: 400 }}>/{total}</span>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{
              fontFamily: "JetBrains Mono", fontSize: 11, color: T.ink3,
              background: T.ivory, padding: "3px 8px", borderRadius: 12, letterSpacing: "0.04em",
            }}>{q.s} · DOK {q.k}</span>
            <button
              onClick={() => mgr.toggleFlag(q.i)}
              style={{ ...btnTiny, background: flagged ? T.saffronSoft : "#fff", color: flagged ? T.saffronDark : T.ink2 }}
            >
              {flagged ? "★ flagged" : "☆ flag"}
            </button>
          </div>

          <div style={{
            fontFamily: "Bricolage Grotesque",
            fontSize: isMobile ? 17 : 16,
            lineHeight: 1.6, color: T.ink, marginTop: 16,
          }}>
            <Stem text={q.q} />
          </div>
          {q.f && F[q.f] && F[q.f]()}

          {q.t === "mcq" && (
            <MCQItem
              q={q}
              value={mgr.answers[q.i]}
              onChange={(v) => mgr.setAnswer(q.i, v)}
              eliminated={eliminations[q.i] || []}
              onToggleEliminate={(i) => toggleEliminate(q.i, i)}
            />
          )}
          {q.t === "grid" && <GridItem q={q} value={mgr.answers[q.i]} onChange={(v) => mgr.setAnswer(q.i, v)} />}
          {q.t === "match" && <MatchItem key={q.i} q={q} value={mgr.answers[q.i]} onChange={(v) => mgr.setAnswer(q.i, v)} />}
          {q.t === "order" && <OrderItem key={q.i} q={q} value={mgr.answers[q.i]} onChange={(v) => mgr.setAnswer(q.i, v)} />}

          <div style={{ display: "flex", gap: 10, marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.rule}` }}>
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} style={navBtn}>← prev</button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setIdx(Math.min(total - 1, idx + 1))}
              disabled={idx === total - 1}
              style={{ ...navBtn, background: T.saffronSoft, borderColor: T.saffron, color: T.saffronDark }}
            >
              next →
            </button>
          </div>
        </div>

        {!isMobile && (
          <div>
            <Navigator />
            <div style={{ marginTop: 12, fontSize: 11, color: T.ink3, fontFamily: "Bricolage Grotesque", lineHeight: 1.6 }}>
              <div>
                <span style={{ display: "inline-block", width: 10, height: 10, background: T.saffronSoft, border: `1px solid ${T.saffron}`, borderRadius: 2, marginRight: 6, verticalAlign: "middle" }} />
                answered
              </div>
              <div>★ flagged for review</div>
              <div style={{ marginTop: 8 }}>Tip: tap × on a choice to strike it through.</div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile navigator drawer */}
      {isMobile && navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(16,32,46,0.40)", zIndex: 90, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.paper, width: "100%", maxHeight: "80vh", overflowY: "auto",
              padding: 20, borderRadius: "16px 16px 0 0",
              boxShadow: "0 -8px 32px rgba(16,32,46,0.20)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.ink, flex: 1 }}>Jump to question</div>
              <button onClick={() => setNavOpen(false)} style={{ background: "none", border: "none", fontSize: 22, color: T.ink2, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 13, color: T.ink2, marginBottom: 12 }}>
              {answered} of {total} answered
            </div>
            <Navigator inDrawer />
          </div>
        </div>
      )}

      {/* Submit modal */}
      {showSubmit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(16,32,46,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{
            background: T.paper, borderRadius: 16, padding: 28, maxWidth: 540, width: "100%",
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(16,32,46,0.20)",
          }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: T.ink, marginBottom: 8 }}>
              Submit your exam?
            </div>
            <p style={{ fontFamily: "Bricolage Grotesque", fontSize: 15, color: T.ink2, lineHeight: 1.6, marginTop: 0 }}>
              You answered <strong>{answered}</strong> of <strong>{total}</strong> questions.
              Once submitted, you cannot change answers.
            </p>

            {unansweredIds.length > 0 && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: T.oxbloodSoft, borderRadius: 10 }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.oxblood, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>
                  Unanswered ({unansweredIds.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {unansweredIds.map((qid) => (
                    <button key={qid} onClick={() => { goTo(qid); setShowSubmit(false); }}
                      style={{
                        fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600,
                        padding: "4px 10px", borderRadius: 6,
                        border: `1px solid ${T.oxblood}`, background: "#fff",
                        color: T.oxblood, cursor: "pointer",
                      }}>Q{qid}</button>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: T.oxblood, fontFamily: "Bricolage Grotesque" }}>
                  Click a question to jump back and answer it.
                </div>
              </div>
            )}

            {flaggedIds.length > 0 && (
              <div style={{ marginTop: 12, padding: "12px 14px", background: T.saffronSoft, borderRadius: 10 }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.saffronDark, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>
                  Flagged for review ({flaggedIds.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {flaggedIds.map((qid) => (
                    <button key={qid} onClick={() => { goTo(qid); setShowSubmit(false); }}
                      style={{
                        fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600,
                        padding: "4px 10px", borderRadius: 6,
                        border: `1px solid ${T.saffron}`, background: "#fff",
                        color: T.saffronDark, cursor: "pointer",
                      }}>Q{qid}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setShowSubmit(false)} style={{ ...navBtn, background: "#fff" }} disabled={submitting}>
                Keep working
              </button>
              <button onClick={doSubmit} style={primaryBtn} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit final answers"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculator panel */}
      {calcOpen && <CalculatorPanel onClose={() => setCalcOpen(false)} isMobile={isMobile} />}
    </div>
  );
}

// =============================================================
//  RESULTS SCREEN
// =============================================================
function ResultsScreen({ session, result, onReview, onPrint, onRestart }) {
  const { score, total, pct, domain_breakdown, dok_breakdown, duration_seconds } = result;
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  const gradeColor = pct >= 80 ? T.forest : pct >= 70 ? T.saffron : T.oxblood;
  const mins = Math.floor((duration_seconds || 0) / 60);
  const secs = (duration_seconds || 0) % 60;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <Header />
      <div style={{ padding: "20px 0", display: "flex", alignItems: "flex-start", gap: 32, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Results · {session.student_name}
          </div>
          <div style={{
            fontFamily: "Fraunces, serif", fontSize: 96, fontWeight: 400,
            lineHeight: 0.95, color: gradeColor,
            fontVariationSettings: '"opsz" 144, "SOFT" 50', marginTop: 8,
          }}>{Math.round(pct)}<span style={{ fontSize: 40, color: T.ink3 }}>%</span></div>
          <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 17, color: T.ink2, marginTop: 8 }}>
            {score} correct out of {total} · grade <span style={{ color: gradeColor, fontWeight: 600 }}>{grade}</span>
          </div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.ink3, marginTop: 4 }}>
            time: {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={onReview} style={primaryBtn}>Review answers →</button>
            <button onClick={onPrint} style={navBtn}>↓ Download report</button>
            <button onClick={onRestart} style={navBtn}>Start over</button>
          </div>
        </div>
        <div style={{ flex: "1 1 320px", display: "grid", gap: 14 }}>
          <div style={panel}>
            <div style={panelHead}>by domain</div>
            {Object.keys(domain_breakdown || {}).map((d) => {
              const v = domain_breakdown[d];
              const p = v.total === 0 ? 0 : (v.correct / v.total) * 100;
              return (
                <div key={d} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Bricolage Grotesque", fontSize: 13, color: T.ink2, marginBottom: 4 }}>
                    <span>{DOMAIN_NAMES[d] || d}</span>
                    <span style={{ fontFamily: "JetBrains Mono", color: T.ink }}>{v.correct}/{v.total}</span>
                  </div>
                  <div style={{ height: 6, background: T.ivory, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", background: DOMAIN_COLORS[d] || T.ink2 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={panel}>
            <div style={panelHead}>by DOK level</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[1, 2, 3].map((k) => {
                const v = (dok_breakdown && dok_breakdown[k]) || { correct: 0, total: 0 };
                return (
                  <div key={k} style={{ background: T.ivory, padding: "10px 12px", borderRadius: 8 }}>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>DOK {k}</div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.ink, fontWeight: 500, marginTop: 2 }}>
                      {v.correct}<span style={{ fontSize: 13, color: T.ink3 }}>/{v.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
//  REVIEW SCREEN — one question at a time, server-graded
// =============================================================
function ReviewScreen({ session, result, onBack, backLabel = "← back to results" }) {
  const QS = session.exam.questions;
  const [idx, setIdx] = useState(0);
  const q = QS[idx];
  const reveal = (result.per_question || {})[String(q.i)] || {};
  const correct = reveal.correct === true;
  const userAns = reveal.student_answer ?? null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <Header />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...navBtn, padding: "6px 12px", fontSize: 13 }}>{backLabel}</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.ink2 }}>reviewing · {session.student_name}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 200px", gap: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
            <div style={{
              fontFamily: "Fraunces, serif", fontSize: 38, fontWeight: 500,
              color: correct ? T.forest : T.oxblood,
              fontVariationSettings: '"opsz" 144', lineHeight: 1,
            }}>{idx + 1}<span style={{ color: T.ink3, fontSize: 18, fontWeight: 400 }}>/{QS.length}</span></div>
            <span style={{
              fontFamily: "JetBrains Mono", fontSize: 11,
              color: correct ? T.forest : T.oxblood,
              background: correct ? T.forestSoft : T.oxbloodSoft,
              padding: "3px 10px", borderRadius: 12, fontWeight: 600,
            }}>{correct ? "✓ correct" : "✗ incorrect"}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.ink3, background: T.ivory, padding: "3px 8px", borderRadius: 12 }}>
              {q.s} · DOK {q.k}
            </span>
          </div>
          <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 16, lineHeight: 1.6, color: T.ink, marginTop: 16 }}>
            <Stem text={q.q} />
          </div>
          {q.f && F[q.f] && F[q.f]()}
          {q.t === "mcq" && <MCQItem q={q} value={userAns} onChange={() => {}} locked correct={reveal.correct_answer} />}
          {q.t === "grid" && <GridItem q={q} value={userAns} onChange={() => {}} locked correctAnswer={reveal.correct_answer} alternates={reveal.accepted_alternates} />}
          {q.t === "match" && <MatchItem key={q.i + "-r"} q={q} value={userAns} onChange={() => {}} locked />}
          {q.t === "order" && <OrderItem key={q.i + "-r"} q={q} value={userAns} onChange={() => {}} locked />}
          {reveal.explanation && (
            <div style={{
              marginTop: 22, padding: "14px 16px", background: T.ivory,
              borderRadius: 10, borderLeft: `3px solid ${T.saffron}`,
            }}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.saffronDark, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>explanation</div>
              <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 14, color: T.ink, lineHeight: 1.6 }}>
                <Stem text={reveal.explanation} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.rule}` }}>
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} style={navBtn}>← prev</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setIdx(Math.min(QS.length - 1, idx + 1))} disabled={idx === QS.length - 1} style={navBtn}>next →</button>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "Bricolage Grotesque", fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>review</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {QS.map((qq, j) => {
              const r = (result.per_question || {})[String(qq.i)] || {};
              const ok = r.correct === true;
              const isCur = j === idx;
              return (
                <button key={qq.i} onClick={() => setIdx(j)}
                  style={{
                    aspectRatio: "1 / 1",
                    border: `1.5px solid ${isCur ? T.ink : ok ? T.forest : T.oxblood}`,
                    background: isCur ? T.ink : ok ? T.forestSoft : T.oxbloodSoft,
                    color: isCur ? T.paper : ok ? T.forest : T.oxblood,
                    fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600,
                    borderRadius: 6, cursor: "pointer",
                  }}>{qq.i}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
//  PRINT REPORT — full report on one page; auto-fires print dialog
// =============================================================
function PrintReport({ session, result, onBack }) {
  const QS = session.exam.questions;
  const { score, total, pct, domain_breakdown, dok_breakdown, duration_seconds, submitted_at } = result;
  const mins = Math.floor((duration_seconds || 0) / 60);
  const secs = (duration_seconds || 0) % 60;

  // Auto-trigger print dialog shortly after mount
  useEffect(() => {
    const t = setTimeout(() => { try { window.print(); } catch {} }, 350);
    return () => clearTimeout(t);
  }, []);

  // Letter for an MCQ index
  const L = (i) => (typeof i === "number" ? ["A", "B", "C", "D"][i] || "?" : "—");
  // Render any answer as a short string
  const renderAnswer = (q, val) => {
    if (val == null) return "(no answer)";
    if (q.t === "mcq") return L(val);
    if (q.t === "grid") return String(val);
    if (q.t === "match") {
      if (!val.assigns) return "(none)";
      return val.assigns.map((ri) => (ri >= 0 ? "✓" : "—")).join(" ");
    }
    if (q.t === "order") return Array.isArray(val) ? val.map((i) => i + 1).join(" → ") : "(none)";
    return JSON.stringify(val);
  };

  return (
    <>
      {/* On-screen action bar (hidden in print) */}
      <div className="no-print" style={{ position: "sticky", top: 0, padding: 12, background: T.paper, borderBottom: `1px solid ${T.rule}`, zIndex: 10 }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={onBack} style={{ ...navBtn, padding: "6px 12px", fontSize: 13 }}>← back</button>
          <div style={{ flex: 1, fontFamily: "Bricolage Grotesque", fontSize: 13, color: T.ink2 }}>
            Use your browser's print dialog → <strong>Save as PDF</strong> to download.
          </div>
          <button onClick={() => window.print()} style={primaryBtn}>Print / Save PDF</button>
        </div>
      </div>

      <div className="print-region" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px", fontFamily: "Georgia, serif", color: T.ink }}>
        <div style={{ borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            TMSA · NC Math 3 EOC Mock
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
            {session.exam.title}
          </div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 8, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <span><strong>Student:</strong> {session.student_name}</span>
            <span><strong>Submitted:</strong> {new Date(submitted_at).toLocaleString()}</span>
            <span><strong>Time taken:</strong> {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 auto" }}>
            <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase" }}>score</div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>
              {score}<span style={{ fontSize: 18, color: "#666" }}>/{total}</span>
              &nbsp;<span style={{ fontSize: 22, color: "#444" }}>({Math.round(pct)}%)</span>
            </div>
          </div>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 4 }}>by domain</div>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <tbody>
                {Object.keys(domain_breakdown || {}).map((d) => {
                  const v = domain_breakdown[d];
                  const p = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
                  return (
                    <tr key={d}>
                      <td style={{ padding: "2px 8px 2px 0" }}>{DOMAIN_NAMES[d] || d}</td>
                      <td style={{ padding: 2, textAlign: "right", fontFamily: "monospace" }}>{v.correct}/{v.total}</td>
                      <td style={{ padding: 2, textAlign: "right", fontFamily: "monospace", color: "#666" }}>({p}%)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 8 }}>
          per-question results
        </div>
        {QS.map((q) => {
          const r = (result.per_question || {})[String(q.i)] || {};
          const ok = r.correct === true;
          const ua = r.student_answer ?? null;
          return (
            <div key={q.i} className="print-q" style={{
              border: "1px solid #ccc", borderLeft: `4px solid ${ok ? "#2E5D3E" : "#8B2530"}`,
              padding: "10px 12px", marginBottom: 8, borderRadius: 4,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, minWidth: 40, fontFamily: "monospace" }}>Q{q.i}</span>
                <span style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>{q.s} · DOK{q.k}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontWeight: 700, fontSize: 12, color: ok ? "#2E5D3E" : "#8B2530" }}>
                  {ok ? "✓ CORRECT" : "✗ INCORRECT"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#222", lineHeight: 1.4, marginBottom: 6 }}>
                <Stem text={q.q} />
              </div>
              <div style={{ fontSize: 12, color: "#444", display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span><strong>Your answer:</strong> {renderAnswer(q, ua)}</span>
                {q.t === "mcq" && <span><strong>Correct:</strong> {L(r.correct_answer)}</span>}
                {q.t === "grid" && <span><strong>Correct:</strong> {String(r.correct_answer)}</span>}
              </div>
              {r.explanation && (
                <div style={{ fontSize: 12, color: "#333", marginTop: 6, paddingTop: 6, borderTop: "1px dashed #ddd" }}>
                  <strong>Explanation: </strong><Stem text={r.explanation} />
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #ccc", fontSize: 10, color: "#888", textAlign: "center" }}>
          NC Math 3 EOC Mock · Generated {new Date().toLocaleString()}
        </div>
      </div>
    </>
  );
}

// =============================================================
//  TEACHER LOGIN
// =============================================================
function TeacherLogin({ onSignedIn, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await signIn(email.trim(), password);
      onSignedIn(r);
    } catch (e) {
      setErr(e.message || "Sign in failed");
    } finally { setBusy(false); }
  };
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <Header />
      <div style={{ padding: "36px 0" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 40, fontWeight: 500, color: T.ink, fontVariationSettings: '"opsz" 144, "SOFT" 30' }}>
          Teacher login
        </div>
        <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
          <label style={lbl}>
            <span>Email</span>
            <input style={inpt} value={email} onChange={(e) => setEmail(e.target.value)} type="email" disabled={busy} />
          </label>
          <label style={lbl}>
            <span>Password</span>
            <input style={inpt} value={password} onChange={(e) => setPassword(e.target.value)} type="password" disabled={busy} />
          </label>
          {err && <div style={{ color: T.oxblood, fontSize: 13 }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
          <button onClick={onBack} style={{ ...navBtn, marginTop: 8 }}>← back</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
//  TEACHER DASHBOARD
// =============================================================
const statBig = {
  fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 500, color: T.ink,
  fontVariationSettings: '"opsz" 144', lineHeight: 1, marginTop: 4,
};
const th = {
  padding: "10px 14px", textAlign: "left", fontFamily: "JetBrains Mono",
  fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
};
const td = {
  padding: "12px 14px", fontFamily: "Bricolage Grotesque", fontSize: 14, color: T.ink,
};

function TeacherDashboard({ onSignOut, onViewSubmission }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("roster");

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const data = await listAttempts({});
      setSubs(data.filter((s) => s.submitted_at));
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const exportCSV = () => {
    const rows = [["name", "email", "class_period", "score", "total", "percent", "duration_s", "submitted"]];
    subs.forEach((s) => rows.push([
      s.student_name, s.student_email || "", s.class_period || "",
      s.score, s.total, s.pct,
      s.duration_seconds || "",
      new Date(s.submitted_at).toISOString(),
    ]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ncm3-results-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const avgPct = subs.length === 0 ? 0 : Math.round(subs.reduce((s, x) => s + Number(x.pct || 0), 0) / subs.length);
  const cohortByDomain = useMemo(() => {
    const dom = { A: { c: 0, t: 0 }, F: { c: 0, t: 0 }, G: { c: 0, t: 0 }, S: { c: 0, t: 0 } };
    subs.forEach((s) => {
      const db = s.domain_breakdown || {};
      Object.keys(db).forEach((d) => {
        if (!dom[d]) dom[d] = { c: 0, t: 0 };
        dom[d].c += db[d].correct || 0;
        dom[d].t += db[d].total || 0;
      });
    });
    return dom;
  }, [subs]);

  const itemStats = useMemo(() => {
    const stats = {};
    subs.forEach((s) => {
      const pq = s.per_question || {};
      Object.keys(pq).forEach((qid) => {
        if (!stats[qid]) stats[qid] = { total: 0, correct: 0, choices: [0, 0, 0, 0], qStandard: null, qDok: null };
        stats[qid].total++;
        if (pq[qid].correct) stats[qid].correct++;
        const ans = pq[qid].student_answer;
        if (typeof ans === "number" && ans >= 0 && ans < 4) stats[qid].choices[ans]++;
      });
    });
    return stats;
  }, [subs]);

  const sortedItems = Object.keys(itemStats).map((qid) => ({
    qid: Number(qid), ...itemStats[qid],
    pct: itemStats[qid].total === 0 ? 100 : (itemStats[qid].correct / itemStats[qid].total) * 100,
  })).sort((a, b) => a.pct - b.pct);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <Header />
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{
          fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 500, color: T.ink,
          fontVariationSettings: '"opsz" 144, "SOFT" 30', letterSpacing: "-0.02em", lineHeight: 1,
        }}>Teacher view</div>
        <div style={{ flex: 1 }} />
        <button onClick={refresh} style={{ ...navBtn, padding: "8px 14px", fontSize: 13 }} disabled={loading}>
          {loading ? "loading…" : "↻ refresh"}
        </button>
        <button onClick={exportCSV} style={{ ...navBtn, padding: "8px 14px", fontSize: 13 }} disabled={subs.length === 0}>↓ export CSV</button>
        <button onClick={onSignOut} style={{ ...navBtn, padding: "8px 14px", fontSize: 13 }}>sign out</button>
      </div>

      {err && (
        <div style={{ padding: 14, background: T.oxbloodSoft, color: T.oxblood, borderRadius: 8, marginBottom: 16, fontFamily: "Bricolage Grotesque" }}>
          {err}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ ...panel, padding: "14px 16px" }}>
          <div style={panelHead}>submissions</div>
          <div style={statBig}>{subs.length}</div>
        </div>
        <div style={{ ...panel, padding: "14px 16px" }}>
          <div style={panelHead}>cohort average</div>
          <div style={{ ...statBig, color: avgPct >= 70 ? T.forest : avgPct >= 60 ? T.saffron : T.oxblood }}>
            {avgPct}<span style={{ fontSize: 16, color: T.ink3, fontWeight: 400 }}>%</span>
          </div>
        </div>
        {Object.keys(cohortByDomain).map((d) => {
          const v = cohortByDomain[d];
          const p = v.t === 0 ? 0 : Math.round((v.c / v.t) * 100);
          return (
            <div key={d} style={{ ...panel, padding: "14px 16px" }}>
              <div style={panelHead}>{(DOMAIN_NAMES[d] || d).split(" ")[0].toLowerCase()}</div>
              <div style={{ ...statBig, color: DOMAIN_COLORS[d] || T.ink }}>{p}<span style={{ fontSize: 16, color: T.ink3, fontWeight: 400 }}>%</span></div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: `1px solid ${T.rule}` }}>
        {[["roster", "Class roster"], ["items", "Item analysis"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: "none", border: "none", padding: "10px 16px",
            fontFamily: "Bricolage Grotesque", fontSize: 14, cursor: "pointer",
            color: tab === key ? T.ink : T.ink3,
            borderBottom: tab === key ? `2px solid ${T.saffron}` : "2px solid transparent",
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === "roster" && (
        subs.length === 0 ? (
          <div style={{
            padding: "40px 20px", textAlign: "center", color: T.ink3,
            fontFamily: "Bricolage Grotesque", fontSize: 15, background: "#fff",
            border: `1px dashed ${T.rule2}`, borderRadius: 12,
          }}>
            No submissions yet. When students submit using code <span style={{ fontFamily: "JetBrains Mono", color: T.saffronDark }}>FORMA-NCM3</span>, their results appear here.
          </div>
        ) : (
          <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.ivory }}>
                  <th style={th}>student</th>
                  <th style={th}>period</th>
                  <th style={{ ...th, textAlign: "right" }}>score</th>
                  <th style={{ ...th, textAlign: "right" }}>%</th>
                  <th style={th}>submitted</th>
                  <th style={{ ...th, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const pct = Math.round(Number(s.pct || 0));
                  return (
                    <tr key={s.id} style={{ borderTop: `1px solid ${T.rule}` }}>
                      <td style={td}>{s.student_name}{s.student_email && <div style={{ fontSize: 12, color: T.ink3 }}>{s.student_email}</div>}</td>
                      <td style={{ ...td, fontFamily: "JetBrains Mono", fontSize: 13, color: T.ink2 }}>{s.class_period || "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "JetBrains Mono" }}>
                        {s.score}<span style={{ color: T.ink3 }}>/{s.total}</span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "JetBrains Mono",
                        color: pct >= 70 ? T.forest : pct >= 60 ? T.saffron : T.oxblood, fontWeight: 600 }}>
                        {pct}%
                      </td>
                      <td style={{ ...td, color: T.ink3, fontSize: 13, fontFamily: "JetBrains Mono" }}>
                        {new Date(s.submitted_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button onClick={() => onViewSubmission(s)} style={{ ...btnTiny, padding: "4px 12px" }}>view →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "items" && (
        subs.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.ink3, fontFamily: "Bricolage Grotesque" }}>
            Item analysis appears once students submit.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              ranked by difficulty (hardest first)
            </div>
            {sortedItems.map(({ qid, total, correct, choices, pct }) => (
              <div key={qid} style={{ ...panel, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: T.ink3, fontWeight: 600, minWidth: 32 }}>Q{qid}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.ink3 }}>n={total}</span>
                  <span style={{
                    fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600,
                    color: pct >= 70 ? T.forest : pct >= 50 ? T.saffron : T.oxblood, minWidth: 50, textAlign: "right",
                  }}>{Math.round(pct)}%</span>
                </div>
                {choices.some((c) => c > 0) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
                    {[0, 1, 2, 3].map((ci) => {
                      const cnt = choices[ci];
                      const cpct = total === 0 ? 0 : (cnt / total) * 100;
                      return (
                        <div key={ci} style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}>
                          <div style={{ color: T.ink3, marginBottom: 2 }}>
                            {["A", "B", "C", "D"][ci]} <span style={{ color: T.ink3 }}>({cnt})</span>
                          </div>
                          <div style={{ height: 4, background: T.ivory, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${cpct}%`, height: "100%", background: T.ink3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// =============================================================
//  ROOT APP — routing + auth state
// =============================================================
export default function App() {
  // route: landing | test | results | review | print | teacher-login | teacher-dashboard | teacher-detail
  const [route, setRoute] = useState("landing");
  const [session, setSession] = useState(null);     // { attempt_id, exam, started_at, student_name }
  const [result, setResult] = useState(null);       // submit result
  const [authSession, setAuthSession] = useState(null);
  const [error, setError] = useState(null);

  // Listen to auth changes
  useEffect(() => {
    let mounted = true;
    getSession().then((s) => { if (mounted) setAuthSession(s); });
    const sub = onAuthStateChange((s) => setAuthSession(s));
    return () => { mounted = false; sub?.data?.subscription?.unsubscribe?.(); };
  }, []);

  // Restore in-progress attempt from sessionStorage
  useEffect(() => {
    if (route !== "landing") return;
    const local = loadLocalSession();
    if (local && local.attempt_id && local.exam) {
      setSession({
        attempt_id: local.attempt_id,
        exam: local.exam,
        started_at: local.started_at,
        student_name: local.student_name || "(resumed)",
        student_email: local.student_email || null,
      });
      setRoute("test");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStarted = (data) => {
    const newSession = {
      attempt_id: data.attempt_id,
      exam: data.exam,
      started_at: data.started_at,
      student_name: data.student_name || "Student",
      student_email: data.student_email || null,
    };
    setSession(newSession);
    saveLocalSession({ ...newSession, answers: {}, flags: [] });
    setRoute("test");
  };

  const handleSubmitDone = (res, sess) => {
    setResult(res);
    setSession(sess);
    setRoute("results");
  };

  const handleRestart = () => {
    clearLocalSession();
    setSession(null);
    setResult(null);
    setRoute("landing");
  };

  // When teacher clicks "view" on a submission, fetch the exam questions then route to detail
  const handleViewSubmission = async (s) => {
    setError(null);
    try {
      const examPublic = await getExamPublic(s.exam_id);
      setSession({
        attempt_id: s.id,
        exam: { ...examPublic },
        started_at: s.started_at,
        student_name: s.student_name,
        student_email: s.student_email,
        _teacherView: true,
      });
      setResult({
        score: s.score, total: s.total, pct: s.pct,
        domain_breakdown: s.domain_breakdown, dok_breakdown: s.dok_breakdown,
        per_question: s.per_question, duration_seconds: s.duration_seconds,
        submitted_at: s.submitted_at,
      });
      setRoute("teacher-detail");
    } catch (e) {
      setError(e.message || "Could not load submission");
    }
  };

  // Auto-route from teacher-login to dashboard once authed
  useEffect(() => {
    if (route === "teacher-login" && authSession) setRoute("teacher-dashboard");
  }, [route, authSession]);

  const wrap = (children) => (
    <div style={{
      minHeight: "100vh", background: T.paper, color: T.ink,
      fontFamily: "Bricolage Grotesque, system-ui, sans-serif",
      padding: "20px 24px 60px",
      backgroundImage: `radial-gradient(circle at 1px 1px, ${T.rule} 1px, transparent 0)`,
      backgroundSize: "24px 24px",
    }}>
      {error && (
        <div style={{ maxWidth: 920, margin: "0 auto 12px", padding: 12, background: T.oxbloodSoft, color: T.oxblood, borderRadius: 8, display: "flex", gap: 12 }}>
          <div style={{ flex: 1, fontFamily: "Bricolage Grotesque", fontSize: 14 }}>{error}</div>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: T.oxblood, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}
      {children}
    </div>
  );

  // Teacher branch
  if (route === "teacher-login") {
    return wrap(<TeacherLogin onSignedIn={() => setRoute("teacher-dashboard")} onBack={() => setRoute("landing")} />);
  }
  if (route === "teacher-dashboard") {
    if (!authSession) return wrap(<TeacherLogin onSignedIn={() => setRoute("teacher-dashboard")} onBack={() => setRoute("landing")} />);
    return wrap(
      <TeacherDashboard
        onSignOut={async () => { await signOut(); setRoute("landing"); }}
        onViewSubmission={handleViewSubmission}
      />
    );
  }
  if (route === "teacher-detail" && session && result) {
    return wrap(
      <ResultsScreen
        session={session}
        result={result}
        onReview={() => setRoute("teacher-detail-review")}
        onPrint={() => setRoute("teacher-detail-print")}
        onRestart={() => setRoute("teacher-dashboard")}
      />
    );
  }
  if (route === "teacher-detail-review" && session && result) {
    return wrap(<ReviewScreen session={session} result={result} onBack={() => setRoute("teacher-detail")} backLabel="← back to summary" />);
  }
  if (route === "teacher-detail-print" && session && result) {
    return wrap(<PrintReport session={session} result={result} onBack={() => setRoute("teacher-detail")} />);
  }

  // Student branch
  if (route === "landing") {
    return wrap(<Landing onStarted={handleStarted} onTeacher={() => setRoute("teacher-login")} />);
  }
  if (route === "test" && session) {
    return wrap(<TestScreen session={session} onSubmitDone={handleSubmitDone} onError={(e) => setError(e)} />);
  }
  if (route === "results" && session && result) {
    return wrap(<ResultsScreen session={session} result={result} onReview={() => setRoute("review")} onPrint={() => setRoute("print")} onRestart={handleRestart} />);
  }
  if (route === "review" && session && result) {
    return wrap(<ReviewScreen session={session} result={result} onBack={() => setRoute("results")} />);
  }
  if (route === "print" && session && result) {
    return wrap(<PrintReport session={session} result={result} onBack={() => setRoute("results")} />);
  }

  return wrap(<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>);
}
