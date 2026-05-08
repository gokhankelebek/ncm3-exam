import React, { useRef, useState } from "react";
import { T, btnTiny } from "./tokens.js";
import { Stem } from "./math.jsx";

// ----- MCQ -----
export function MCQItem({ q, value, onChange, locked, correct, eliminated = [], onToggleEliminate }) {
  const letters = ["A", "B", "C", "D"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 14 }}>
      {q.c.map((choice, i) => {
        const selected = value === i;
        const isCorrect = locked && i === correct;
        const isWrong = locked && selected && i !== correct;
        const isEliminated = !locked && eliminated.includes(i);
        return (
          <button
            key={i}
            disabled={locked}
            onClick={() => onChange(i)}
            style={{
              textAlign: "left", padding: "12px 14px", borderRadius: 10,
              cursor: locked ? "default" : "pointer",
              background: isCorrect ? T.forestSoft : isWrong ? T.oxbloodSoft : selected ? T.saffronSoft : "#fff",
              border: `1.5px solid ${isCorrect ? T.forest : isWrong ? T.oxblood : selected ? T.saffron : T.rule}`,
              fontFamily: "Bricolage Grotesque, sans-serif", fontSize: 15,
              color: T.ink, display: "flex", gap: 12, alignItems: "flex-start",
              transition: "all 0.12s",
              opacity: isEliminated && !selected ? 0.45 : 1,
            }}
          >
            <span style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 13,
              color: isCorrect ? T.forest : isWrong ? T.oxblood : selected ? T.saffronDark : T.ink3,
              fontWeight: 600, minWidth: 18,
              textDecoration: isEliminated && !selected ? "line-through" : "none",
            }}>{letters[i]}</span>
            <span style={{
              flex: 1,
              textDecoration: isEliminated && !selected ? "line-through" : "none",
            }}><Stem text={choice} /></span>
            {isCorrect && <span style={{ color: T.forest, fontSize: 18 }}>✓</span>}
            {isWrong && <span style={{ color: T.oxblood, fontSize: 18 }}>✗</span>}
            {!locked && onToggleEliminate && (
              <span
                role="button"
                tabIndex={0}
                aria-label={isEliminated ? `Restore choice ${letters[i]}` : `Eliminate choice ${letters[i]}`}
                onClick={(e) => { e.stopPropagation(); onToggleEliminate(i); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onToggleEliminate(i); } }}
                title={isEliminated ? "Restore" : "Strike through"}
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 14, lineHeight: 1, color: isEliminated ? T.saffronDark : T.ink3,
                  padding: "4px 6px", borderRadius: 4,
                  border: `1px solid ${isEliminated ? T.saffron : T.rule2}`,
                  background: isEliminated ? T.saffronSoft : "#fff",
                  cursor: "pointer", userSelect: "none",
                  alignSelf: "center",
                }}
              >×</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ----- Grid-in -----
// In locked mode, `correctAnswer` is the server-revealed correct value.
export function GridItem({ q, value, onChange, locked, correctAnswer, alternates }) {
  const isUserCorrect = (() => {
    if (!locked) return null;
    if (value == null || value === "") return false;
    const v = String(value).trim();
    if (Array.isArray(alternates) && alternates.some((a) =>
      String(a).toLowerCase().replace(/\s/g, "") === v.toLowerCase().replace(/\s/g, "")
    )) return true;
    const num = parseFloat(v);
    if (!isFinite(num) || correctAnswer == null) return false;
    return Math.abs(num - Number(correctAnswer)) <= 0.1;
  })();
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          placeholder="enter answer"
          style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 18, padding: "10px 14px",
            border: `1.5px solid ${locked ? (isUserCorrect ? T.forest : T.oxblood) : T.rule2}`,
            borderRadius: 10,
            background: locked ? (isUserCorrect ? T.forestSoft : T.oxbloodSoft) : "#fff",
            outline: "none", width: 200, color: T.ink,
          }}
        />
        {q.unit && <span style={{ color: T.ink2, fontFamily: "Bricolage Grotesque", fontSize: 15 }}>{q.unit}</span>}
        {locked && (
          <span style={{
            fontSize: 13, fontFamily: "JetBrains Mono, monospace",
            color: isUserCorrect ? T.forest : T.oxblood,
          }}>
            {isUserCorrect ? "correct" : `correct: ${correctAnswer}`}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: T.ink3 }}>
        Numeric or fractional. Decimals, fractions like 15/2, all OK.
      </div>
    </div>
  );
}

// ----- Match -----
// `value` shape: { assigns: number[], rightOrder: number[], _allCorrect: boolean }
// In locked mode we trust the server's per_question.correct_pairs to mark per-row correctness.
export function MatchItem({ q, value, onChange, locked }) {
  const rightOrderRef = useRef(null);
  if (!rightOrderRef.current) {
    if (value && Array.isArray(value.rightOrder)) {
      rightOrderRef.current = value.rightOrder;
    } else {
      const idx = q.pairs.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      rightOrderRef.current = idx;
    }
  }
  const rightOrder = rightOrderRef.current;
  const v = (value && value.assigns) || q.pairs.map(() => -1);
  const setLeft = (li, ri) => {
    const next = [...v];
    for (let k = 0; k < next.length; k++) if (next[k] === ri) next[k] = -1;
    next[li] = ri;
    const allCorrect = next.every((rj, lj) => rj >= 0 && rightOrder[rj] === lj);
    onChange({ assigns: next, _allCorrect: allCorrect, rightOrder });
  };
  const used = new Set(v.filter((x) => x >= 0));
  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      {q.pairs.map((p, li) => {
        const selectedRi = v[li];
        const correctRi = rightOrder.indexOf(li);
        const isCorrect = locked && selectedRi === correctRi;
        const isWrong = locked && selectedRi !== correctRi;
        return (
          <div key={li} style={{
            display: "grid", gridTemplateColumns: "1fr 30px 1.4fr",
            alignItems: "center", gap: 10, padding: "10px 12px",
            border: `1px solid ${isCorrect ? T.forest : isWrong ? T.oxblood : T.rule}`,
            borderRadius: 10,
            background: isCorrect ? T.forestSoft : isWrong ? T.oxbloodSoft : "#fff",
          }}>
            <div style={{ fontSize: 15, color: T.ink }}><Stem text={p.l} /></div>
            <div style={{ color: T.ink3, textAlign: "center" }}>→</div>
            <select
              value={selectedRi}
              onChange={(e) => setLeft(li, parseInt(e.target.value))}
              disabled={locked}
              style={{
                fontFamily: "Bricolage Grotesque", fontSize: 13, padding: "8px 10px",
                border: `1px solid ${T.rule2}`, borderRadius: 8, background: "#fff", color: T.ink,
              }}>
              <option value={-1}>— choose —</option>
              {rightOrder.map((origIdx, ri) => (
                <option key={ri} value={ri} disabled={used.has(ri) && selectedRi !== ri}>
                  {q.pairs[origIdx].r.replace(/\$([^$]+)\$/g, (_m, x) => x)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ----- Order -----
// `value` is an array of original-indices in the user's chosen order.
export function OrderItem({ q, value, onChange, locked }) {
  const initRef = useRef(false);
  if (!initRef.current && !Array.isArray(value)) {
    const idx = q.items.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    onChange(idx);
    initRef.current = true;
  }
  const cur = Array.isArray(value) ? value : q.items.map((_, i) => i);
  const move = (from, to) => {
    if (locked) return;
    if (to < 0 || to >= cur.length) return;
    const next = [...cur];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  return (
    <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
      {cur.map((idx, pos) => {
        const isCorrect = locked && idx === pos;
        const isWrong = locked && idx !== pos;
        return (
          <div key={pos} style={{
            display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 12,
            alignItems: "center", padding: "10px 12px",
            border: `1px solid ${isCorrect ? T.forest : isWrong ? T.oxblood : T.rule}`,
            borderRadius: 10,
            background: isCorrect ? T.forestSoft : isWrong ? T.oxbloodSoft : "#fff",
          }}>
            <span style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: T.ink2,
              background: T.ivory, borderRadius: 13, width: 26, height: 26,
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
            }}>{pos + 1}</span>
            <span style={{ fontSize: 15, color: T.ink }}><Stem text={q.items[idx]} /></span>
            {!locked && (
              <span style={{ display: "flex", gap: 4 }}>
                <button onClick={() => move(pos, pos - 1)} style={btnTiny} disabled={pos === 0}>↑</button>
                <button onClick={() => move(pos, pos + 1)} style={btnTiny} disabled={pos === cur.length - 1}>↓</button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
