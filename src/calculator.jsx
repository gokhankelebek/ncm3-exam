import React, { useEffect, useRef, useState } from "react";
import { T } from "./tokens.js";

// Desmos provides a free public API key for embedding their calculator.
// (See https://www.desmos.com/api/v1.10/docs/index.html — apiKey=dcb3...)
const DESMOS_API_KEY = "dcb31709b452b1cf9dc26972add0fda6";

let _desmosLoadPromise = null;
function loadDesmos() {
  if (_desmosLoadPromise) return _desmosLoadPromise;
  _desmosLoadPromise = new Promise((resolve, reject) => {
    if (window.Desmos) return resolve(window.Desmos);
    const script = document.createElement("script");
    script.src = `https://www.desmos.com/api/v1.10/calculator.js?apiKey=${DESMOS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.Desmos);
    script.onerror = () => reject(new Error("Failed to load Desmos"));
    document.head.appendChild(script);
  });
  return _desmosLoadPromise;
}

// Floating calculator panel. On mobile, takes near full screen; on desktop,
// docks bottom-right. Toggleable from the test screen.
export function CalculatorPanel({ onClose, isMobile }) {
  const containerRef = useRef(null);
  const calcRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadDesmos()
      .then((Desmos) => {
        if (cancelled || !containerRef.current) return;
        try {
          calcRef.current = Desmos.GraphingCalculator(containerRef.current, {
            keypad: true,
            graphpaper: true,
            expressions: true,
            settingsMenu: true,
            zoomButtons: true,
            border: false,
          });
          setLoaded(true);
        } catch (e) {
          setError(String(e));
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      try { calcRef.current?.destroy?.(); } catch {}
    };
  }, []);

  const panelStyle = isMobile
    ? {
        position: "fixed",
        top: 12, right: 12, bottom: 12, left: 12,
        zIndex: 200,
      }
    : {
        position: "fixed",
        bottom: 16, right: 16,
        width: 420, height: 540,
        zIndex: 200,
      };

  return (
    <div style={{
      ...panelStyle,
      background: "#fff",
      border: `1px solid ${T.rule2}`,
      borderRadius: 12,
      boxShadow: "0 12px 40px rgba(16, 32, 46, 0.25)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderBottom: `1px solid ${T.rule}`,
        background: T.ivory,
      }}>
        <span style={{
          fontFamily: "Bricolage Grotesque", fontSize: 13, fontWeight: 600, color: T.ink,
          flex: 1,
        }}>
          Desmos Graphing Calculator
        </span>
        <button onClick={onClose} aria-label="Close calculator" style={{
          background: "none", border: "none", color: T.ink2,
          fontSize: 22, lineHeight: 1, cursor: "pointer", padding: "0 4px",
        }}>×</button>
      </div>
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        {!loaded && !error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#fff", color: T.ink3,
            fontFamily: "Bricolage Grotesque", fontSize: 14,
          }}>
            Loading calculator…
          </div>
        )}
        {error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: T.oxblood,
            fontFamily: "Bricolage Grotesque", fontSize: 13,
            padding: 16, textAlign: "center",
          }}>
            Couldn't load Desmos. Check your network connection and try again.
          </div>
        )}
      </div>
    </div>
  );
}
