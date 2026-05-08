import React from "react";
import { T } from "./tokens.js";

// =============================================================
//  PER-QUESTION FIGURES — inline SVG, registered by key
// =============================================================
const FIG_W = 360;

function Frame({ children, w = FIG_W, h = 220, vb }) {
  return (
    <svg
      viewBox={vb || `0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: w, display: "block", margin: "12px auto" }}
      role="img"
    >
      {children}
    </svg>
  );
}

function plotPath(fn, xMin, xMax, yMin, yMax, W, H, samples = 200) {
  const xS = (x) => ((x - xMin) / (xMax - xMin)) * W;
  const yS = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  let d = "";
  let started = false;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    let y;
    try { y = fn(x); } catch { y = NaN; }
    if (!isFinite(y) || y < yMin - 1 || y > yMax + 1) {
      started = false;
      continue;
    }
    const X = xS(x), Y = yS(y);
    d += (started ? "L" : "M") + X.toFixed(2) + "," + Y.toFixed(2) + " ";
    started = true;
  }
  return { d, xS, yS };
}

function Axes({ xMin, xMax, yMin, yMax, W, H, xTicks, yTicks }) {
  const xS = (x) => ((x - xMin) / (xMax - xMin)) * W;
  const yS = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  const x0 = xS(0), y0 = yS(0);
  const xs = xTicks || [], ys = yTicks || [];
  return (
    <g>
      <line x1={0} y1={y0} x2={W} y2={y0} stroke={T.ink3} strokeWidth="1" />
      <line x1={x0} y1={0} x2={x0} y2={H} stroke={T.ink3} strokeWidth="1" />
      {xs.map((t) => (
        <g key={"x" + t}>
          <line x1={xS(t)} y1={y0 - 3} x2={xS(t)} y2={y0 + 3} stroke={T.ink3} />
          {t !== 0 && <text x={xS(t)} y={y0 + 14} fontSize="10" fill={T.ink2} textAnchor="middle">{t}</text>}
        </g>
      ))}
      {ys.map((t) => (
        <g key={"y" + t}>
          <line x1={x0 - 3} y1={yS(t)} x2={x0 + 3} y2={yS(t)} stroke={T.ink3} />
          {t !== 0 && <text x={x0 - 6} y={yS(t) + 3} fontSize="10" fill={T.ink2} textAnchor="end">{t}</text>}
        </g>
      ))}
      <text x={W - 4} y={y0 - 4} fontSize="10" fill={T.ink2} textAnchor="end" fontStyle="italic">x</text>
      <text x={x0 + 5} y={10} fontSize="10" fill={T.ink2} fontStyle="italic">y</text>
    </g>
  );
}

const cell = { border: `1px solid ${T.rule2}`, padding: "6px 12px", textAlign: "center", background: T.paper };
const cellL = { ...cell, fontStyle: "italic", background: T.ivory };

// =============================================================
//  Figure registry — keys match question.f
// =============================================================
export const F = {};

// Q12: parabola y=x^2 and line y=x+2
F.q12 = () => {
  const W = 320,
    H = 200,
    xMin = -3,
    xMax = 3,
    yMin = -1,
    yMax = 6;
  const p1 = plotPath((x) => x * x, xMin, xMax, yMin, yMax, W, H);
  const p2 = plotPath((x) => x + 2, xMin, xMax, yMin, yMax, W, H);
  const xS = p1.xS,
    yS = p1.yS;
  return (
    <Frame w={W + 30} h={H + 30} vb={`-20 -10 ${W + 30} ${H + 30}`}>
      <Axes xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} W={W} H={H} xTicks={[-3, -2, -1, 1, 2, 3]} yTicks={[1, 2, 3, 4, 5]} />
      <path d={p1.d} fill="none" stroke={T.saffron} strokeWidth="2" />
      <path d={p2.d} fill="none" stroke={T.oxblood} strokeWidth="2" />
      <text x={W - 8} y={yS(W * 0 + 5)} fontSize="11" fill={T.saffron} textAnchor="end">f(x)</text>
      <text x={W - 8} y={yS(5) + 14} fontSize="11" fill={T.oxblood} textAnchor="end">g(x)</text>
      <circle cx={xS(-1)} cy={yS(1)} r="3" fill={T.ink} />
      <circle cx={xS(2)} cy={yS(4)} r="3" fill={T.ink} />
    </Frame>
  );
};

// Q16: shaded region — y < -x+4 (dashed), y >= x-2 (solid), x >= 0 (solid)
F.q16 = () => {
  const W = 320,
    H = 220,
    xMin = -2,
    xMax = 6,
    yMin = -3,
    yMax = 5.5;
  const xS = (x) => ((x - xMin) / (xMax - xMin)) * W;
  const yS = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  // region vertices: x=0 from y=-2 up to y=4, intersect at (3,1), down to (0,-2)
  // intersection of y=-x+4 and y=x-2: x=3, y=1
  const polygon = `${xS(0)},${yS(4)} ${xS(3)},${yS(1)} ${xS(0)},${yS(-2)}`;
  return (
    <Frame w={W + 30} h={H + 30} vb={`-20 -10 ${W + 30} ${H + 30}`}>
      <Axes xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} W={W} H={H} xTicks={[-1, 1, 2, 3, 4, 5]} yTicks={[-2, -1, 1, 2, 3, 4]} />
      <polygon points={polygon} fill={T.saffron} fillOpacity="0.18" stroke="none" />
      <line x1={xS(-1)} y1={yS(5)} x2={xS(5)} y2={yS(-1)} stroke={T.oxblood} strokeWidth="2" strokeDasharray="5 4" />
      <line x1={xS(-1)} y1={yS(-3)} x2={xS(5)} y2={yS(3)} stroke={T.ink} strokeWidth="2" />
      <line x1={xS(0)} y1={yS(-3)} x2={xS(0)} y2={yS(5)} stroke={T.ink} strokeWidth="2" />
      <text x={xS(4.2)} y={yS(0.2)} fontSize="11" fill={T.oxblood}>y = -x + 4</text>
      <text x={xS(4.2)} y={yS(2.6)} fontSize="11" fill={T.ink2}>y = x - 2</text>
    </Frame>
  );
};

// Q21: cubic graph, increasing on (-2,1)
F.q21 = () => {
  const W = 320,
    H = 220,
    xMin = -3.5,
    xMax = 3.5,
    yMin = -3.5,
    yMax = 3.5;
  const fn = (x) => -x * x * x / 3 - x * x / 2 + 2 * x + 0.7;
  const p = plotPath(fn, xMin, xMax, yMin, yMax, W, H, 240);
  return (
    <Frame w={W + 30} h={H + 30} vb={`-20 -10 ${W + 30} ${H + 30}`}>
      <Axes xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} W={W} H={H} xTicks={[-3, -2, -1, 1, 2, 3]} yTicks={[-3, -2, -1, 1, 2, 3]} />
      <path d={p.d} fill="none" stroke={T.saffron} strokeWidth="2.2" />
    </Frame>
  );
};

// Q22: table for g(x)
F.q22 = () => (
  <table style={{ borderCollapse: "collapse", margin: "12px auto", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>
    <tbody>
      <tr>
        <td style={cellL}>x</td>
        {[1, 2, 3, 4, 5].map((v) => (
          <td key={v} style={cell}>
            {v}
          </td>
        ))}
      </tr>
      <tr>
        <td style={cellL}>g(x)</td>
        {[3, 5, 9, 17, 33].map((v, i) => (
          <td key={i} style={cell}>
            {v}
          </td>
        ))}
      </tr>
    </tbody>
  </table>
);

// Q26: graph + table side by side (parabola peak + table for g)
F.q26 = () => {
  const W = 200,
    H = 160,
    xMin = -0.5,
    xMax = 5.5,
    yMin = -1,
    yMax = 9;
  const fn = (x) => -1.5 * (x - 2.5) * (x - 2.5) + 8;
  const p = plotPath(fn, xMin, xMax, yMin, yMax, W, H, 200);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", flexWrap: "wrap", margin: "12px 0" }}>
      <svg viewBox={`-20 -10 ${W + 30} ${H + 30}`} width={W + 30} height={H + 30}>
        <Axes xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} W={W} H={H} xTicks={[1, 2, 3, 4, 5]} yTicks={[2, 4, 6, 8]} />
        <path d={p.d} fill="none" stroke={T.saffron} strokeWidth="2" />
        <text x={W - 6} y={14} fontSize="11" fill={T.saffron} textAnchor="end">f(t)</text>
      </svg>
      <table style={{ borderCollapse: "collapse", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={cellL}>t</td>
            {[0, 1, 2, 3, 4].map((v) => (
              <td key={v} style={cell}>
                {v}
              </td>
            ))}
          </tr>
          <tr>
            <td style={cellL}>g(t)</td>
            {[-2, 4, 8, 10, 6].map((v, i) => (
              <td key={i} style={cell}>
                {v}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Q37: sinusoid y = 3 sin(x) + 1
F.q37 = () => {
  const W = 340,
    H = 200,
    xMin = -0.4,
    xMax = 6.6,
    yMin = -3,
    yMax = 5;
  const fn = (x) => 3 * Math.sin(x) + 1;
  const p = plotPath(fn, xMin, xMax, yMin, yMax, W, H, 240);
  return (
    <Frame w={W + 40} h={H + 30} vb={`-30 -10 ${W + 40} ${H + 30}`}>
      <Axes xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} W={W} H={H} xTicks={[]} yTicks={[-2, -1, 1, 2, 3, 4]} />
      {[
        [Math.PI / 2, "π/2"],
        [Math.PI, "π"],
        [(3 * Math.PI) / 2, "3π/2"],
        [2 * Math.PI, "2π"],
      ].map(([xv, lbl], i) => {
        const X = ((xv - xMin) / (xMax - xMin)) * W;
        const y0 = H - ((0 - yMin) / (yMax - yMin)) * H;
        return (
          <g key={i}>
            <line x1={X} y1={y0 - 3} x2={X} y2={y0 + 3} stroke={T.ink3} />
            <text x={X} y={y0 + 14} fontSize="10" fill={T.ink2} textAnchor="middle">
              {lbl}
            </text>
          </g>
        );
      })}
      <line
        x1={0}
        y1={H - ((1 - yMin) / (yMax - yMin)) * H}
        x2={W}
        y2={H - ((1 - yMin) / (yMax - yMin)) * H}
        stroke={T.ink3}
        strokeDasharray="3 3"
      />
      <path d={p.d} fill="none" stroke={T.saffron} strokeWidth="2.2" />
    </Frame>
  );
};

// Q39: linear graph through (0,50) and (5,70) — labeled in thousands
F.q39 = () => {
  const W = 320,
    H = 200,
    xMin = -0.4,
    xMax = 6.4,
    yMin = -5,
    yMax = 90;
  const fn = (x) => 50 + 4 * x;
  const xS = (x) => ((x - xMin) / (xMax - xMin)) * W;
  const yS = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  const p = plotPath(fn, xMin, xMax, yMin, yMax, W, H, 50);
  return (
    <Frame w={W + 40} h={H + 30} vb={`-30 -10 ${W + 40} ${H + 30}`}>
      <line x1={0} y1={yS(0)} x2={W} y2={yS(0)} stroke={T.ink3} />
      <line x1={xS(0)} y1={0} x2={xS(0)} y2={H} stroke={T.ink3} />
      {[1, 2, 3, 4, 5, 6].map((t) => (
        <g key={t}>
          <line x1={xS(t)} y1={yS(0) - 3} x2={xS(t)} y2={yS(0) + 3} stroke={T.ink3} />
          <text x={xS(t)} y={yS(0) + 14} fontSize="10" fill={T.ink2} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      {[20, 40, 60, 80].map((y) => (
        <g key={y}>
          <line x1={xS(0) - 3} y1={yS(y)} x2={xS(0) + 3} y2={yS(y)} stroke={T.ink3} />
          <text x={xS(0) - 6} y={yS(y) + 3} fontSize="10" fill={T.ink2} textAnchor="end">
            {y}
          </text>
        </g>
      ))}
      <text x={W - 4} y={yS(0) - 4} fontSize="10" fill={T.ink2} textAnchor="end" fontStyle="italic">t</text>
      <text x={xS(0) + 5} y={10} fontSize="10" fill={T.ink2}>pop. (thousands)</text>
      <path d={p.d} fill="none" stroke={T.saffron} strokeWidth="2.2" />
      <text x={xS(5.5)} y={yS(72)} fontSize="11" fill={T.saffron} fontStyle="italic">f(t)</text>
    </Frame>
  );
};

// Q42: triangle with midsegment
F.q42 = () => {
  const A = [180, 30],
    B = [70, 180],
    C = [290, 180];
  const D = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const E = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
  return (
    <Frame w={360} h={210}>
      <polygon points={`${A.join(",")} ${B.join(",")} ${C.join(",")}`} fill="none" stroke={T.ink} strokeWidth="2" />
      <line x1={D[0]} y1={D[1]} x2={E[0]} y2={E[1]} stroke={T.saffron} strokeWidth="2" />
      {[A, B, C, D, E].map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={T.ink} />
      ))}
      <text x={A[0]} y={A[1] - 8} fontSize="13" fill={T.ink} textAnchor="middle" fontStyle="italic">A</text>
      <text x={B[0] - 10} y={B[1] + 6} fontSize="13" fill={T.ink} textAnchor="end" fontStyle="italic">B</text>
      <text x={C[0] + 10} y={C[1] + 6} fontSize="13" fill={T.ink} fontStyle="italic">C</text>
      <text x={D[0] - 10} y={D[1] + 4} fontSize="13" fill={T.ink2} textAnchor="end" fontStyle="italic">D</text>
      <text x={E[0] + 10} y={E[1] + 4} fontSize="13" fill={T.ink2} fontStyle="italic">E</text>
      <text x={(B[0] + C[0]) / 2} y={B[1] + 18} fontSize="12" fill={T.ink2} textAnchor="middle">14</text>
    </Frame>
  );
};

// Q43: triangle PQR, sides 8 and 12, angle 60° at P
F.q43 = () => {
  // place P at origin, Q to the right at (8u, 0), R at angle 60° from P at distance 12
  const scale = 14;
  const P = [60, 180],
    Q = [60 + 8 * scale, 180],
    R = [60 + 12 * scale * Math.cos(Math.PI / 3), 180 - 12 * scale * Math.sin(Math.PI / 3)];
  return (
    <Frame w={360} h={220}>
      <polygon points={`${P.join(",")} ${Q.join(",")} ${R.join(",")}`} fill="none" stroke={T.ink} strokeWidth="2" />
      <text x={P[0] - 8} y={P[1] + 14} fontSize="13" fill={T.ink} textAnchor="end" fontStyle="italic">P</text>
      <text x={Q[0] + 8} y={Q[1] + 14} fontSize="13" fill={T.ink} fontStyle="italic">Q</text>
      <text x={R[0]} y={R[1] - 8} fontSize="13" fill={T.ink} textAnchor="middle" fontStyle="italic">R</text>
      <text x={(P[0] + Q[0]) / 2} y={P[1] + 16} fontSize="12" fill={T.ink2} textAnchor="middle">8</text>
      <text x={(P[0] + R[0]) / 2 - 14} y={(P[1] + R[1]) / 2} fontSize="12" fill={T.ink2} textAnchor="end">12</text>
      <path
        d={`M ${P[0] + 26} ${P[1]} A 26 26 0 0 0 ${P[0] + 26 * Math.cos(Math.PI / 3)} ${P[1] - 26 * Math.sin(Math.PI / 3)}`}
        fill="none"
        stroke={T.ink2}
      />
      <text x={P[0] + 36} y={P[1] - 12} fontSize="11" fill={T.ink2}>60°</text>
    </Frame>
  );
};

// Q44: triangle ABC, a=7, b=9, C=50°
F.q44 = () => {
  // place B at origin, A to the right at unknown side c on horizontal; place C using a from B at angle (180-50)=130 from BA
  // simpler: place B left, A right (separated by c, unknown). Use computed c≈7.0.
  const scale = 16;
  const c = 7.0; // computed
  const B = [60, 200],
    A = [60 + c * scale, 200];
  // angle ABC and BAC: use law of sines: a/sin A = b/sin B = c/sin C
  // Use coords: from B along the line BA, then measure b from A and a from B at known angle? Easier: place C above using known a,b.
  // C at distance b from A and distance a from B; intersect circles.
  const dx = A[0] - B[0],
    dy = A[1] - B[1];
  const dAB = Math.hypot(dx, dy);
  const a = 7,
    b = 9;
  const cx = (dAB * dAB + b * b - a * a) / (2 * dAB);
  // wait: place A at origin then C at distance b... let me redo simpler:
  // From A, C is at distance b. The angle BAC = arcsin(a/c · sin C) but messy. Use cosine to get angle A:
  // cos A = (b^2 + c^2 - a^2) / (2bc). place A = (0,0), B = (c,0), then C = (b cos A, -b sin A)
  const Ar = [60, 200];
  const Br = [60 + c * scale, 200];
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const Cr = [Ar[0] + b * scale * cosA, Ar[1] - b * scale * sinA];
  return (
    <Frame w={360} h={230}>
      <polygon points={`${Ar.join(",")} ${Br.join(",")} ${Cr.join(",")}`} fill="none" stroke={T.ink} strokeWidth="2" />
      <text x={Ar[0] - 8} y={Ar[1] + 14} fontSize="13" fill={T.ink} textAnchor="end" fontStyle="italic">A</text>
      <text x={Br[0] + 8} y={Br[1] + 14} fontSize="13" fill={T.ink} fontStyle="italic">B</text>
      <text x={Cr[0]} y={Cr[1] - 8} fontSize="13" fill={T.ink} textAnchor="middle" fontStyle="italic">C</text>
      <text x={(Br[0] + Cr[0]) / 2 + 8} y={(Br[1] + Cr[1]) / 2} fontSize="12" fill={T.ink2}>a = 7</text>
      <text x={(Ar[0] + Cr[0]) / 2 - 8} y={(Ar[1] + Cr[1]) / 2} fontSize="12" fill={T.ink2} textAnchor="end">b = 9</text>
      <text x={(Ar[0] + Br[0]) / 2} y={Ar[1] + 16} fontSize="12" fill={T.ink2} textAnchor="middle">c = ?</text>
      <text x={Cr[0] - 14} y={Cr[1] + 14} fontSize="11" fill={T.ink2}>50°</text>
    </Frame>
  );
};

// Q45: triangle with angles 30°, 45°
F.q45 = () => {
  const A = [60, 200],
    B = [320, 200];
  const C = [200, 110];
  return (
    <Frame w={360} h={220}>
      <polygon points={`${A.join(",")} ${B.join(",")} ${C.join(",")}`} fill="none" stroke={T.ink} strokeWidth="2" />
      <text x={A[0] - 8} y={A[1] + 14} fontSize="13" fill={T.ink} textAnchor="end" fontStyle="italic">A</text>
      <text x={B[0] + 8} y={B[1] + 14} fontSize="13" fill={T.ink} fontStyle="italic">B</text>
      <text x={C[0]} y={C[1] - 8} fontSize="13" fill={T.ink} textAnchor="middle" fontStyle="italic">C</text>
      <text x={A[0] + 22} y={A[1] - 6} fontSize="11" fill={T.ink2}>30°</text>
      <text x={B[0] - 22} y={B[1] - 6} fontSize="11" fill={T.ink2} textAnchor="end">45°</text>
      <text x={(B[0] + C[0]) / 2 + 6} y={(B[1] + C[1]) / 2 - 4} fontSize="12" fill={T.ink2}>a = 10</text>
    </Frame>
  );
};

// Q48: cone
F.q48 = () => {
  const cx = 180,
    cy = 170,
    rx = 60,
    ry = 18,
    apexY = 50;
  return (
    <Frame w={360} h={210}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={T.ink} strokeWidth="2" />
      <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`} fill="none" stroke={T.ink} strokeWidth="2" strokeDasharray="4 3" />
      <line x1={cx - rx} y1={cy} x2={cx} y2={apexY} stroke={T.ink} strokeWidth="2" />
      <line x1={cx + rx} y1={cy} x2={cx} y2={apexY} stroke={T.ink} strokeWidth="2" />
      <line x1={cx + rx + 14} y1={cy} x2={cx + rx + 14} y2={apexY} stroke={T.ink2} markerEnd="url(#a)" markerStart="url(#a)" />
      <defs>
        <marker id="a" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={T.ink2} />
        </marker>
      </defs>
      <text x={cx + rx + 22} y={(cy + apexY) / 2 + 4} fontSize="12" fill={T.ink2}>h = 9</text>
      <text x={cx} y={cy + 36} fontSize="12" fill={T.ink2} textAnchor="middle">d = 8</text>
    </Frame>
  );
};

// Q49: sphere on cone
F.q49 = () => {
  const cx = 180,
    cone_top = 90,
    apex = 200,
    rx = 38,
    ry = 12,
    sR = 36;
  return (
    <Frame w={360} h={250}>
      <circle cx={cx} cy={cone_top - sR + 8} r={sR} fill="none" stroke={T.ink} strokeWidth="2" />
      <ellipse cx={cx} cy={cone_top} rx={rx} ry={ry} fill="none" stroke={T.ink} strokeWidth="2" strokeDasharray="3 3" />
      <line x1={cx - rx} y1={cone_top} x2={cx} y2={apex} stroke={T.ink} strokeWidth="2" />
      <line x1={cx + rx} y1={cone_top} x2={cx} y2={apex} stroke={T.ink} strokeWidth="2" />
      <text x={cx + rx + 8} y={cone_top - sR + 8} fontSize="12" fill={T.ink2}>r = 3</text>
      <text x={cx + rx + 8} y={(cone_top + apex) / 2} fontSize="12" fill={T.ink2}>10</text>
      <text x={cx} y={cone_top + 26} fontSize="12" fill={T.ink2} textAnchor="middle">d = 6</text>
    </Frame>
  );
};

// Q51: silo (cylinder + hemisphere)
F.q51 = () => {
  const cx = 180,
    rx = 50,
    ry = 12,
    top = 80,
    bottom = 200;
  return (
    <Frame w={360} h={240}>
      <line x1={cx - rx} y1={top} x2={cx - rx} y2={bottom} stroke={T.ink} strokeWidth="2" />
      <line x1={cx + rx} y1={top} x2={cx + rx} y2={bottom} stroke={T.ink} strokeWidth="2" />
      <ellipse cx={cx} cy={bottom} rx={rx} ry={ry} fill="none" stroke={T.ink} strokeWidth="2" />
      <path d={`M ${cx - rx} ${bottom} A ${rx} ${ry} 0 0 1 ${cx + rx} ${bottom}`} fill={T.ivory} stroke={T.ink} strokeWidth="2" strokeDasharray="3 3" />
      <path d={`M ${cx - rx} ${top} A ${rx} ${rx} 0 0 1 ${cx + rx} ${top}`} fill="none" stroke={T.ink} strokeWidth="2" />
      <path d={`M ${cx - rx} ${top} A ${rx} ${ry} 0 0 0 ${cx + rx} ${top}`} fill="none" stroke={T.ink} strokeWidth="2" />
      <text x={cx + rx + 12} y={(top + bottom) / 2} fontSize="12" fill={T.ink2}>20 ft</text>
      <text x={cx} y={bottom + 28} fontSize="12" fill={T.ink2} textAnchor="middle">d = 12 ft</text>
    </Frame>
  );
};

// Q52: cylinder with cone removed (dashed)
F.q52 = () => {
  const cx = 180,
    rx = 46,
    ry = 12,
    top = 70,
    bottom = 200;
  return (
    <Frame w={360} h={230}>
      <line x1={cx - rx} y1={top} x2={cx - rx} y2={bottom} stroke={T.ink} strokeWidth="2" />
      <line x1={cx + rx} y1={top} x2={cx + rx} y2={bottom} stroke={T.ink} strokeWidth="2" />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill="none" stroke={T.ink} strokeWidth="2" />
      <ellipse cx={cx} cy={bottom} rx={rx} ry={ry} fill="none" stroke={T.ink} strokeWidth="2" />
      <line x1={cx - rx} y1={top} x2={cx} y2={bottom} stroke={T.ink2} strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1={cx + rx} y1={top} x2={cx} y2={bottom} stroke={T.ink2} strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={cx + rx + 14} y={(top + bottom) / 2} fontSize="12" fill={T.ink2}>h = 12</text>
      <text x={cx} y={bottom + 26} fontSize="12" fill={T.ink2} textAnchor="middle">d = 10</text>
    </Frame>
  );
};

// Q53: pizza
F.q53 = () => {
  const cx = 180,
    cy = 110,
    R = 70;
  // 8 slices
  const lines = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    lines.push(<line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke={T.ink} strokeWidth="1.5" />);
  }
  // shaded slice from 45° to 90° (i.e. one wedge)
  const a1 = -Math.PI / 4,
    a2 = -Math.PI / 2;
  const sx1 = cx + R * Math.cos(a1),
    sy1 = cy + R * Math.sin(a1);
  const sx2 = cx + R * Math.cos(a2),
    sy2 = cy + R * Math.sin(a2);
  return (
    <Frame w={360} h={210}>
      <path d={`M ${cx} ${cy} L ${sx1} ${sy1} A ${R} ${R} 0 0 0 ${sx2} ${sy2} Z`} fill={T.saffronSoft} stroke={T.ink} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.ink} strokeWidth="2" />
      {lines}
      <line x1={cx} y1={cy} x2={cx - R} y2={cy} stroke={T.saffron} strokeWidth="2" />
      <text x={cx - R / 2} y={cy - 6} fontSize="11" fill={T.saffronDark} textAnchor="middle">r = 9</text>
    </Frame>
  );
};

// Q54: chord with perpendicular distance from center
F.q54 = () => {
  const cx = 180,
    cy = 130,
    R = 70;
  // chord at y = cy - 6*scale (perp dist 6 from center at scale 5 → 30 px? scale 7 → 42)
  const scale = 7;
  const dist = 6 * scale; // 42
  const half = 8 * scale; // 56
  const A = [cx - half, cy - dist],
    B = [cx + half, cy - dist];
  const M = [cx, cy - dist];
  return (
    <Frame w={360} h={250}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.ink} strokeWidth="2" />
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={T.ink} strokeWidth="2" />
      <line x1={cx} y1={cy} x2={M[0]} y2={M[1]} stroke={T.ink} strokeWidth="1.5" />
      <line x1={cx} y1={cy} x2={A[0]} y2={A[1]} stroke={T.ink2} strokeDasharray="4 3" />
      <rect x={M[0]} y={M[1]} width={8} height={8} fill="none" stroke={T.ink} />
      {[A, B, M, [cx, cy]].map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={T.ink} />
      ))}
      <text x={A[0] - 6} y={A[1] - 6} fontSize="13" fill={T.ink} textAnchor="end" fontStyle="italic">A</text>
      <text x={B[0] + 6} y={B[1] - 6} fontSize="13" fill={T.ink} fontStyle="italic">B</text>
      <text x={M[0] + 12} y={M[1] - 4} fontSize="13" fill={T.ink2} fontStyle="italic">M</text>
      <text x={cx + 8} y={cy + 14} fontSize="13" fill={T.ink2} fontStyle="italic">O</text>
      <text x={cx + 4} y={(cy + M[1]) / 2 + 4} fontSize="11" fill={T.ink2}>6</text>
      <text x={(A[0] + M[0]) / 2} y={A[1] - 6} fontSize="11" fill={T.ink2} textAnchor="middle">8</text>
    </Frame>
  );
};
