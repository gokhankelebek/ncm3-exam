// Design tokens. Cream paper / deep ink / saffron accent.
export const T = {
  paper: "#FBF7EE",
  ink: "#10202E",
  ink2: "#3B4B59",
  ink3: "#7C8A98",
  rule: "#E5DDC9",
  rule2: "#D4C9AE",
  saffron: "#C57820",
  saffronDark: "#9C5C12",
  saffronSoft: "#F4E5C8",
  forest: "#2E5D3E",
  forestSoft: "#DCE7DC",
  oxblood: "#8B2530",
  oxbloodSoft: "#F2DADD",
  ivory: "#F6F0E0",
  shadow: "0 1px 2px rgba(16,32,46,0.06), 0 6px 24px -8px rgba(16,32,46,0.10)",
};

// Common style fragments
export const lbl = { display: "grid", gap: 4, fontFamily: "Bricolage Grotesque", fontSize: 13, color: T.ink2 };
export const inpt = {
  padding: "10px 12px", fontSize: 15, border: `1.5px solid ${T.rule2}`,
  borderRadius: 8, background: "#fff", color: T.ink,
  fontFamily: "Bricolage Grotesque", outline: "none",
};
export const primaryBtn = {
  padding: "12px 18px", fontSize: 15, fontWeight: 500, border: "none",
  borderRadius: 8, background: T.ink, color: T.paper, cursor: "pointer",
  fontFamily: "Bricolage Grotesque", marginTop: 4,
};
export const navBtn = {
  padding: "10px 16px", fontSize: 14, border: `1px solid ${T.rule2}`,
  background: "#fff", borderRadius: 8, cursor: "pointer", color: T.ink,
  fontFamily: "Bricolage Grotesque",
};
export const btnTiny = {
  padding: "4px 10px", fontSize: 14, border: `1px solid ${T.rule2}`,
  background: "#fff", borderRadius: 6, cursor: "pointer", color: T.ink,
};
export const panel = { background: "#fff", border: `1px solid ${T.rule}`, borderRadius: 12, padding: 16 };
export const panelHead = {
  fontFamily: "JetBrains Mono", fontSize: 11, color: T.ink3,
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12,
};

export const DOMAIN_NAMES = {
  A: "Number & Quantity / Algebra",
  F: "Functions",
  G: "Geometry",
  S: "Statistics & Probability",
};
export const DOMAIN_COLORS = { A: T.saffron, F: T.forest, G: T.oxblood, S: "#5C5298" };
