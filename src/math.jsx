import React, { useEffect, useRef } from "react";
import katex from "katex";

// Render a LaTeX string with KaTeX. Falls back to text on error.
export function Tex({ tex, display = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      ref.current.textContent = tex;
    }
  }, [tex, display]);
  return <span ref={ref} style={display ? { display: "block", margin: "8px 0" } : {}} />;
}

// Splits a string on $...$ inline-math segments and renders each.
// Honors `\$` as a LITERAL dollar sign (not a math delimiter).
export function Stem({ text }) {
  if (!text) return null;
  // Protect escaped \$ from being seen as a math delimiter.
  // Use a Private-Use Area codepoint that won't appear in real content.
  const PLACE = "\uE000";
  const protectedText = String(text).replace(/\\\$/g, PLACE);
  const parts = protectedText.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") && p.length > 2 ? (
          <Tex key={i} tex={p.slice(1, -1)} />
        ) : (
          <span key={i}>{p.split(PLACE).join("$")}</span>
        )
      )}
    </>
  );
}
