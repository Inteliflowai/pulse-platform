'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── PULSE Brand Tokens ─────────────────────────────────── */
const BRAND = {
  bg: "#120800", bg2: "#1f0e00", bg3: "#2e1800",
  white: "#ffffff", text: "#fff4eb", muted: "#d4a574",
  line: "rgba(255,255,255,0.14)", card: "rgba(255,255,255,0.07)", cardStrong: "rgba(255,255,255,0.14)",
  orange: "#f26522", deepOrange: "#e84c1e", amber: "#f59e0b",
  brown: "#6b3a1f", warmRed: "#d4451a", emerald: "#10b981",
  blue: "#3b82f6", violet: "#8b5cf6", cyan: "#06b6d4", mint: "#ffb380",
  shadow: "0 24px 80px rgba(18, 8, 0, 0.50)",
};
const PULSE_GLOW = { from: "#f26522", to: "#e84c1e" };

/* ─── Helpers ─────────────────────────────────────────────── */
function Section({ id, children, style = {}, fullWidth = false }: any) {
  return <section id={id} className="pulse-section" style={style}>{fullWidth ? children : <div className="pulse-container">{children}</div>}</section>;
}
function Glass({ children, style = {}, className = "" }: any) {
  return <div className={className} style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 28, boxShadow: BRAND.shadow, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", ...style }}>{children}</div>;
}
function Glow({ left, right, top, bottom, size = 240, from = BRAND.orange, to = BRAND.deepOrange, opacity = 0.18 }: any) {
  return <div className="p-glow" style={{ position: "absolute", left, right, top, bottom, width: size, height: size, borderRadius: 999, background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`, filter: "blur(60px)", opacity, pointerEvents: "none" }} />;
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED DEMO — 4 screens, 10s cycle, crossfade
   ═══════════════════════════════════════════════════════════ */
const DB = { ...BRAND, red: "#ef4444", line2: "rgba(242,101,34,0.25)", card2: "rgba(18,8,0,0.88)" };
const dGlass = { background: DB.card2, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${DB.line2}`, borderRadius: 16, fontFamily: "'DM Sans',system-ui,sans-serif", color: DB.text };
const dpill = (color: string) => ({ display: "inline-flex" as const, alignItems: "center" as const, gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}44` });

function DashboardScreen() {
  const nodes = [{ name: "Node A — Library", online: true, devices: 12, cpu: "23%" }, { name: "Node B — Science Lab", online: true, devices: 8, cpu: "45%" }, { name: "Node C — Sports Hall", online: false, devices: 0, cpu: "—" }];
  return <div style={{ padding: 20 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Westview Academy</div><div style={{ fontSize: 11, color: DB.muted, marginBottom: 16 }}>3 Nodes Online</div><div style={{ display: "grid", gap: 8 }}>{nodes.map(n => <div key={n.name} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: n.online ? DB.emerald : DB.red, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: DB.text, fontSize: 12 }}>{n.name}</div>{n.online ? <div style={{ color: DB.muted, marginTop: 2 }}>{n.devices} devices · CPU {n.cpu}</div> : <div style={{ color: DB.red, marginTop: 2, fontSize: 10 }}>Syncing when back online</div>}</div><span style={dpill(n.online ? DB.emerald : DB.red)}>{n.online ? "Online" : "Offline"}</span></div>)}</div><div style={{ marginTop: 14, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 10, color: DB.muted, textAlign: "center" }}>48 assets synced · 12 sequences published · 3 active classrooms</div></div>;
}
function ClassroomScreen() {
  return <div style={{ padding: 20 }}><div style={{ background: "#0a0500", borderRadius: 10, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", marginBottom: 12 }}><div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(242,101,34,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 18, marginLeft: 3, color: "#fff" }}>{"\u25B6"}</span></div><div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.1)" }}><div style={{ width: "67%", height: "100%", background: DB.orange, borderRadius: 2 }} /></div></div><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cell Division: Mitosis & Meiosis</div><div style={{ display: "flex", gap: 8, marginBottom: 10 }}><span style={dpill(DB.blue)}>Biology</span><span style={dpill(DB.amber)}>Grade 9</span></div><div style={{ fontSize: 11, color: DB.muted, marginBottom: 6 }}>Part 2 of 4 in today&apos;s sequence</div><div style={{ fontSize: 11, color: DB.orange, marginBottom: 12 }}>{"\u2192"} Quiz: Cell Division (after this video)</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 11, color: DB.muted }}>Jordan Kim · Room 204</div><span style={dpill(DB.emerald)}>Offline ready {"\u2713"}</span></div></div>;
}
function SequenceScreen() {
  const items = [{ icon: "\uD83D\uDCF9", title: "Introduction to Mitosis", meta: "12 min", done: true }, { icon: "\u2753", title: "Mitosis Basics", meta: "5 questions · CORE", done: true }, { icon: "\uD83D\uDCF9", title: "Meiosis & Genetic Variation", meta: "15 min", playing: true }, { icon: "\u26A1", title: "Chromosome Sorting", meta: "Spark", upcoming: true }, { icon: "\uD83D\uDCF9", title: "Cell Cycle Regulation", meta: "10 min", upcoming: true }, { icon: "\u2753", title: "Full Unit Assessment", meta: "CORE", upcoming: true }];
  return <div style={{ padding: 20 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Cell Biology Unit — Week 3</div><div style={{ fontSize: 11, color: DB.muted, marginBottom: 14 }}>Learning Sequence</div><div style={{ display: "grid", gap: 6 }}>{items.map((it: any, i: number) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, fontSize: 11, background: it.playing ? "rgba(242,101,34,0.12)" : "rgba(255,255,255,0.03)", border: it.playing ? `1px solid ${DB.line2}` : "1px solid transparent" }}><span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{it.icon}</span><div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: it.upcoming ? DB.muted : DB.text, fontSize: 12 }}>{it.title}</div><div style={{ color: DB.muted, marginTop: 1, fontSize: 10 }}>{it.meta}</div></div>{it.done && <span style={{ color: DB.emerald, fontSize: 12, fontWeight: 700 }}>{"\u2713"}</span>}{it.playing && <span style={dpill(DB.orange)}>{"\u25B6"} Playing</span>}</div>)}</div><div style={{ marginTop: 10, fontSize: 10, color: DB.muted, textAlign: "center" }}>Assigned to: Grade 9 Biology · Rooms 201, 204</div></div>;
}
function ConductorScreen() {
  const students = [{ init: "JK", status: "watching", pct: "67%" }, { init: "AL", status: "watching", pct: "54%" }, { init: "MR", status: "completed" }, { init: "TS", status: "watching", pct: "72%" }, { init: "NP", status: "watching", pct: "61%" }, { init: "RD", status: "completed" }, { init: "KW", status: "watching", pct: "45%" }, { init: "BJ", status: "paused" }, { init: "LM", status: "watching", pct: "80%" }, { init: "SC", status: "watching", pct: "58%" }, { init: "AH", status: "watching", pct: "63%" }, { init: "YZ", status: "watching", pct: "70%" }];
  const sc: Record<string, string> = { watching: DB.blue, completed: DB.emerald, paused: DB.amber };
  return <div style={{ padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Live Session</div><span style={dpill(DB.emerald)}>24 connected</span></div><div style={{ fontSize: 11, color: DB.muted, marginBottom: 12 }}>Room 204 · Meiosis & Genetic Variation</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>{students.map((s, i) => <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 10 }}><div style={{ width: 26, height: 26, borderRadius: 999, background: `${sc[s.status]}22`, color: sc[s.status], display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{s.init}</div><div style={{ color: DB.muted, fontSize: 9 }}>{s.status === "completed" ? "done \u2713" : s.status === "paused" ? "paused" : s.pct}</div></div>)}</div><div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{["\u23F8 Pause All", "\u23ED Next", "\uD83D\uDCCA Live Results"].map(l => <div key={l} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 10, fontWeight: 600, color: DB.text }}>{l}</div>)}</div><div style={{ background: "rgba(242,101,34,0.1)", border: `1px solid ${DB.line2}`, borderRadius: 8, padding: "8px 10px", fontSize: 10, color: DB.orange }}>3 students completed early — auto-advancing to quiz</div></div>;
}
const DEMO_SCREENS = [{ label: "Cloud Dashboard", C: DashboardScreen }, { label: "Classroom Player", C: ClassroomScreen }, { label: "Sequence Builder", C: SequenceScreen }, { label: "Conductor Mode", C: ConductorScreen }];
function PulseAnimatedDemo() {
  const [cur, setCur] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => { const t = setInterval(() => { setVis(false); setTimeout(() => { setCur(c => (c + 1) % DEMO_SCREENS.length); setVis(true); }, 380); }, 10000); return () => clearInterval(t); }, []);
  const S = DEMO_SCREENS[cur].C;
  return <div style={{ maxWidth: 520, width: "100%" }}><div style={{ ...dGlass, overflow: "hidden" }}><div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{DEMO_SCREENS.map((s, i) => <button key={s.label} onClick={() => { setVis(false); setTimeout(() => { setCur(i); setVis(true); }, 380); }} style={{ flex: 1, padding: "10px 4px", border: "none", cursor: "pointer", background: i === cur ? "rgba(242,101,34,0.12)" : "transparent", borderBottom: i === cur ? `2px solid ${DB.orange}` : "2px solid transparent", color: i === cur ? DB.orange : DB.muted, fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans',system-ui,sans-serif", transition: "all .2s" }}>{s.label}</button>)}</div><div style={{ opacity: vis ? 1 : 0, transition: "opacity 380ms ease-in-out", minHeight: 340 }}><S /></div></div></div>;
}

/* ═══════════════════════════════════════════════════════════
   CLASSROOM SIMULATOR — 4-step interactive walkthrough
   ═══════════════════════════════════════════════════════════ */
const simGlass = { background: "rgba(18,8,0,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(242,101,34,0.25)", borderRadius: 16, fontFamily: "'DM Sans',system-ui,sans-serif", color: BRAND.text };
const btnP: React.CSSProperties = { padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',system-ui,sans-serif", boxShadow: "0 4px 16px rgba(242,101,34,0.3)", width: "100%" };

function SimVideoStep({ onNext }: { onNext: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  function play() { setPlaying(true); iv.current = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(iv.current!); setDone(true); setPlaying(false); return 100; } return p + 2; }), 100); }
  useEffect(() => () => { if (iv.current) clearInterval(iv.current); }, []);
  return <div><div onClick={!playing && !done ? play : undefined} style={{ background: "linear-gradient(135deg,#0a0500,#120800,#0a0500)", borderRadius: 10, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", cursor: !playing && !done ? "pointer" : "default", marginBottom: 14 }}>{!playing && !done && <div style={{ textAlign: "center" }}><div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>{[BRAND.orange, BRAND.amber, BRAND.emerald].map((c, i) => <div key={i} style={{ width: 20, height: 20, borderRadius: 999, background: `${c}33`, border: `1px solid ${c}66` }} />)}</div><div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 10px", background: "rgba(242,101,34,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(242,101,34,0.4)" }}><span style={{ fontSize: 22, marginLeft: 4, color: "#fff" }}>{"\u25B6"}</span></div><div style={{ fontSize: 11, color: BRAND.muted }}>Click to play</div></div>}{playing && <div style={{ textAlign: "center" }}><div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "end", height: 40, marginBottom: 10 }}>{[28,40,20,36,24,32,18,38,26,34].map((h, i) => <div key={i} style={{ width: 4, borderRadius: 2, background: BRAND.orange, height: h, opacity: 0.6 + Math.random() * 0.4 }} />)}</div><div style={{ fontSize: 12, color: BRAND.muted }}>{Math.floor(progress * 0.12)}:{String(Math.floor((progress * 7.2) % 60)).padStart(2, "0")} / 12:00</div></div>}{done && <div style={{ textAlign: "center" }}><div style={{ fontSize: 36, color: BRAND.emerald, marginBottom: 6 }}>{"\u2713"}</div><div style={{ fontSize: 13, color: BRAND.text }}>Video complete</div></div>}<div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.1)" }}><div style={{ width: `${progress}%`, height: "100%", background: BRAND.orange, borderRadius: 2, transition: "width 100ms linear" }} /></div></div><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Introduction to Chemical Reactions</div><div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 16 }}>Chemistry {"\u00b7"} Grade 10</div>{done && <button onClick={onNext} style={btnP}>Next in sequence {"\u2192"}</button>}</div>;
}

const QUESTIONS = [
  { q: "What is a catalyst?", opts: ["A substance that slows reactions", "A substance that speeds up reactions without being consumed", "A type of chemical bond", "A product of combustion"], correct: 1 },
  { q: "What type of reaction absorbs energy?", opts: ["Exothermic", "Endothermic", "Synthesis", "Decomposition"], correct: 1 },
  { q: "Balance this equation: H\u2082 + O\u2082 \u2192 H\u2082O", opts: ["H\u2082 + O\u2082 \u2192 H\u2082O", "2H\u2082 + O\u2082 \u2192 2H\u2082O", "H\u2082 + 2O\u2082 \u2192 2H\u2082O", "3H\u2082 + O\u2082 \u2192 3H\u2082O"], correct: 1 },
];

function SimQuizStep({ onNext, onScore }: { onNext: () => void; onScore: (s: number, a: number[]) => void }) {
  const [qi, setQi] = useState(0); const [sel, setSel] = useState<number | null>(null); const [answers, setAnswers] = useState<number[]>([]); const [showRes, setShowRes] = useState(false);
  const L = "ABCD";
  function pick(idx: number) { if (sel !== null) return; setSel(idx); }
  function next() { const na = [...answers, sel!]; setAnswers(na); setSel(null); if (qi + 1 >= QUESTIONS.length) { const sc = na.filter((a, i) => a === QUESTIONS[i].correct).length; onScore(sc, na); setShowRes(true); } else setQi(qi + 1); }
  if (showRes) { const sc = answers.filter((a, i) => a === QUESTIONS[i].correct).length; return <div style={{ textAlign: "center", padding: "20px 0" }}><div style={{ fontSize: 48, fontWeight: 800, color: sc >= 2 ? BRAND.emerald : BRAND.amber, marginBottom: 8 }}>{sc}/{QUESTIONS.length}</div><div style={{ fontSize: 14, color: BRAND.text, marginBottom: 4 }}>Quiz complete</div><div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 20 }}>{sc >= 2 ? "Good work!" : "Review the material and try again."}</div><button onClick={onNext} style={btnP}>Continue {"\u2192"}</button></div>; }
  const q = QUESTIONS[qi];
  return <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 11, color: BRAND.muted }}>CORE Quiz {"\u00b7"} Question {qi + 1} of {QUESTIONS.length}</div><div style={{ fontSize: 11, color: BRAND.orange, fontWeight: 600 }}>Chemistry</div></div><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>{q.q}</div><div style={{ display: "grid", gap: 8, marginBottom: 16 }}>{q.opts.map((opt, i) => { const isSel = sel === i; const isCorr = sel !== null && i === q.correct; const isWrong = isSel && i !== q.correct; let bg = "rgba(255,255,255,0.04)", bdr = "1px solid rgba(255,255,255,0.08)", lBg = "rgba(255,255,255,0.1)", lC = BRAND.muted; if (isSel && isCorr) { bg = "rgba(16,185,129,0.15)"; bdr = `1px solid ${BRAND.emerald}`; lBg = BRAND.emerald; lC = "#fff"; } if (isWrong) { bg = "rgba(239,68,68,0.12)"; bdr = "1px solid #ef4444"; lBg = "#ef4444"; lC = "#fff"; } if (!isSel && sel !== null && isCorr) { bg = "rgba(16,185,129,0.08)"; bdr = `1px solid ${BRAND.emerald}44`; } return <div key={i} onClick={() => pick(i)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: bg, border: bdr, cursor: sel === null ? "pointer" : "default", transition: "all .2s", fontSize: 13 }}><div style={{ width: 28, height: 28, borderRadius: 999, background: lBg, color: lC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{L[i]}</div><span style={{ color: BRAND.text }}>{opt}</span></div>; })}</div>{sel !== null && <button onClick={next} style={btnP}>{qi + 1 >= QUESTIONS.length ? "See Results" : "Next Question"} {"\u2192"}</button>}</div>;
}

function SimSparkStep({ onNext, onResult }: { onNext: () => void; onResult: (c: boolean) => void }) {
  const [ans, setAns] = useState<string | null>(null);
  function pick(c: string) { setAns(c); onResult(c === "faster"); }
  return <div><div style={{ fontSize: 11, color: BRAND.amber, fontWeight: 600, marginBottom: 14 }}>Spark {"\u00b7"} Prediction</div><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, lineHeight: 1.5 }}>If you increase the temperature of a reaction, will it proceed faster or slower?</div>{ans === null ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{(["faster", "slower"] as const).map(c => <button key={c} onClick={() => pick(c)} style={{ padding: "16px 0", borderRadius: 10, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: BRAND.text, fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans',system-ui,sans-serif" }}>{c === "faster" ? "\u2191 Faster" : "\u2193 Slower"}</button>)}</div> : <div style={{ textAlign: "center", padding: "10px 0" }}><div style={{ fontSize: 36, color: ans === "faster" ? BRAND.emerald : "#ef4444", marginBottom: 8 }}>{ans === "faster" ? "\u2713" : "\u2717"}</div><div style={{ fontSize: 15, fontWeight: 700, color: BRAND.text, marginBottom: 6 }}>{ans === "faster" ? "Correct!" : "Not quite."}</div><div style={{ fontSize: 13, color: BRAND.muted, marginBottom: 20, lineHeight: 1.6 }}>Higher temperature = more kinetic energy = faster molecular collisions = faster reaction rate.</div><button onClick={onNext} style={btnP}>Continue {"\u2192"}</button></div>}</div>;
}

function SimResultsStep({ quizScore, quizAnswers, sparkCorrect }: { quizScore: number; quizAnswers: number[]; sparkCorrect: boolean }) {
  const pct = Math.round((quizScore / QUESTIONS.length) * 100);
  const total = quizScore + (sparkCorrect ? 1 : 0);
  return <div><div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: BRAND.text }}>Session Complete</div><div style={{ fontSize: 12, color: BRAND.muted }}>Chemistry {"\u00b7"} Grade 10</div></div><div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><div style={{ width: 90, height: 90, borderRadius: 999, border: `3px solid ${pct >= 67 ? BRAND.emerald : BRAND.amber}`, background: `${pct >= 67 ? BRAND.emerald : BRAND.amber}15`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: pct >= 67 ? BRAND.emerald : BRAND.amber }}>{pct}%</div><div style={{ fontSize: 9, color: BRAND.muted }}>{total}/{QUESTIONS.length + 1} correct</div></div></div><div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 600, color: BRAND.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Breakdown</div><div style={{ display: "grid", gap: 6 }}>{QUESTIONS.map((q, i) => { const ok = quizAnswers[i] === q.correct; return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", fontSize: 12 }}><div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: ok ? `${BRAND.emerald}22` : "#ef444422", color: ok ? BRAND.emerald : "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{ok ? "\u2713" : "\u2717"}</div><div style={{ flex: 1, color: BRAND.text, fontSize: 11 }}>{q.q}</div></div>; })}<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", fontSize: 12 }}><div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: sparkCorrect ? `${BRAND.emerald}22` : "#ef444422", color: sparkCorrect ? BRAND.emerald : "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{sparkCorrect ? "\u2713" : "\u2717"}</div><div style={{ flex: 1, color: BRAND.text, fontSize: 11 }}>Spark: Temperature prediction</div><div style={{ fontSize: 9, color: BRAND.amber, fontWeight: 600 }}>SPARK</div></div></div></div><div style={{ background: "rgba(242,101,34,0.08)", border: `1px solid rgba(242,101,34,0.25)`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: BRAND.text, lineHeight: 1.6 }}>{pct >= 67 ? "Strong performance. Results synced to your teacher via CORE." : "Review catalysts before next class. Results synced to your teacher via CORE."}</div><a href="#contact" style={{ ...btnP, display: "block", textDecoration: "none", textAlign: "center" }}>See how Pulse works for your school {"\u2192"}</a></div>;
}

function PulseClassroomSimulator() {
  const [step, setStep] = useState(0);
  const [qs, setQs] = useState(0); const [qa, setQa] = useState<number[]>([]); const [sc, setSc] = useState(false);
  const qsR = useRef(0); const qaR = useRef<number[]>([]);
  function handleScore(s: number, a: number[]) { qsR.current = s; qaR.current = a; setQs(s); setQa(a); }
  const steps = ["Video", "Quiz", "Spark", "Results"];
  return <div style={{ maxWidth: 480, margin: "0 auto" }}><div style={{ ...simGlass, borderRadius: 20, boxShadow: "0 32px 80px rgba(18,8,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, color: BRAND.orange }}>Pulse</span><span style={{ color: BRAND.muted }}>Room 204</span><span style={{ color: BRAND.muted }}>{"\u00b7"}</span><span style={{ color: BRAND.text }}>Jordan Kim</span></div><div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: BRAND.emerald }} /><span style={{ fontSize: 10, color: BRAND.emerald }}>Online</span></div></div><div style={{ display: "flex", gap: 3, padding: "8px 16px" }}>{steps.map((s, i) => <div key={s} style={{ flex: 1, textAlign: "center" }}><div style={{ height: 3, borderRadius: 2, background: i <= step ? BRAND.orange : "rgba(255,255,255,0.08)", transition: "background .3s", marginBottom: 4 }} /><div style={{ fontSize: 9, color: i === step ? BRAND.orange : BRAND.muted, fontWeight: i === step ? 700 : 400 }}>{s}</div></div>)}</div><div style={{ padding: "12px 20px 24px" }}>{step === 0 && <SimVideoStep onNext={() => setStep(1)} />}{step === 1 && <><div style={{ background: "rgba(242,101,34,0.08)", border: "1px solid rgba(242,101,34,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: BRAND.orange, marginBottom: 14 }}>CORE is preparing your quiz...</div><SimQuizStep onNext={() => setStep(2)} onScore={handleScore} /></>}{step === 2 && <><div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: BRAND.amber, marginBottom: 14 }}>Loading Spark experience...</div><SimSparkStep onNext={() => setStep(3)} onResult={setSc} /></>}{step === 3 && <SimResultsStep quizScore={qsR.current} quizAnswers={qaR.current} sparkCorrect={sc} />}</div></div><p style={{ textAlign: "center", fontSize: 11, color: BRAND.muted, marginTop: 16, lineHeight: 1.6, maxWidth: 400, marginInline: "auto" }}>This is a simulation. In a real classroom, content streams from a local Pulse node — no internet required during the lesson.</p></div>;
}

/* ═══════════════════════════════════════════════════════════
   PAGE SECTIONS
   ═══════════════════════════════════════════════════════════ */
function Header() {
  return <header style={{ position: "relative", zIndex: 50, background: "rgba(18,8,0,0.85)", borderBottom: `1px solid ${BRAND.line}`, backdropFilter: "blur(16px)" }}><div className="pulse-container" style={{ padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 16 }}><a href="https://inteliflowai.com" title="Back to Inteliflow" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card, color: BRAND.muted, fontSize: 18, textDecoration: "none", flexShrink: 0 }}>&larr;</a><a href="#top" style={{ display: "flex", alignItems: "center", gap: 12 }}><img src="/pulse-logo.png" alt="Pulse" style={{ height: 60, width: "auto", objectFit: "contain" }} /></a></div><nav style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "flex-end" }}><a href="#features" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Features</a><a href="#how-it-works" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>How It Works</a><a href="#architecture" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Architecture</a><a href="#platform" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Platform</a><a href="#contact" style={{ padding: "14px 18px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 10px 30px rgba(242,101,34,0.35)" }}>Contact Us</a></nav></div></header>;
}

function Hero() {
  return <Section id="top" style={{ paddingTop: 16, paddingBottom: 24, overflow: "hidden" }}><Glow left={-60} top={10} size={300} from={PULSE_GLOW.from} to={PULSE_GLOW.to} /><Glow right={-50} top={40} size={260} from={BRAND.amber} to={BRAND.warmRed} /><div className="p-grid-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 36, alignItems: "center" }}><div><div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}><div style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981", animation: "pulse-glow 2s ease-in-out infinite" }} /><span style={{ fontSize: 12, color: BRAND.muted }}>Part of the Inteliflow Learning Ecosystem</span></div><h1 className="p-title" style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: -2.8, color: BRAND.text, margin: 0 }}>Learning Intelligence<br /><span style={{ background: `linear-gradient(135deg, ${PULSE_GLOW.from}, ${PULSE_GLOW.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>for classroom delivery</span></h1><p style={{ marginTop: 16, fontSize: 26, lineHeight: 1.3, color: BRAND.text, fontWeight: 600, maxWidth: 680, letterSpacing: -0.5 }}>Built on pedagogy. Powered by AI.</p><p style={{ marginTop: 16, fontSize: 19, lineHeight: 1.7, color: BRAND.muted, maxWidth: 660 }}>Curriculum, video, and formative checks orchestrated in real time — online or offline, cloud or on-premises.</p><div className="p-hero-btns" style={{ marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap" }}><a href="#contact" style={{ padding: "16px 22px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 12px 30px rgba(242,101,34,0.35)" }}>Get Started</a><a href="#how-it-works" style={{ padding: "16px 22px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.cardStrong, color: BRAND.text, fontWeight: 700 }}>See How It Works</a><a href="#classroom-demo" style={{ padding: "16px 22px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.cardStrong, color: BRAND.text, fontWeight: 700, fontSize: 14 }}>Try Classroom Demo</a></div></div><PulseAnimatedDemo /></div></Section>;
}

function StatsBar() {
  return <div style={{ borderTop: `1px solid ${BRAND.line}`, borderBottom: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.03)" }}><div className="pulse-container" style={{ padding: "36px 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, textAlign: "center" }}>{[{ value: "50+", label: "Dashboard Pages" }, { value: "100%", label: "Offline Capable" }, { value: "3", label: "Languages" }, { value: "45+", label: "API Endpoints" }].map(s => <div key={s.label}><div style={{ fontSize: 36, fontWeight: 800, color: BRAND.text }}>{s.value}</div><div style={{ fontSize: 13, color: BRAND.muted, marginTop: 4 }}>{s.label}</div></div>)}</div></div>;
}

function Features() {
  const items = [
    { icon: "\u26A1", title: "Offline-First Delivery", desc: "Content syncs to on-prem nodes and plays locally. No internet? No problem. Students never see a loading spinner. Lesson completions queue locally and sync when WAN returns." },
    { icon: "\uD83D\uDCC5", title: "Classroom Scheduling", desc: "Schedule which class watches which content in which room at what time. STBs auto-load content when the next class arrives. Supports recurring, daily, and weekly schedules." },
    { icon: "\uD83C\uDF93", title: "Mobile Teacher Conductor", desc: "Teachers control classrooms from any device. Mobile-first conductor with swipe navigation, live stats, and a 3-step Quick Lesson wizard to go from video to scheduled class in under a minute." },
    { icon: "\uD83E\uDDE0", title: "CORE Quiz Handoff", desc: "When a video ends, Pulse fires a lesson-complete event. CORE delivers personalized quizzes matched to mastery. Offline fallback serves 3 MCQ when CORE is unreachable." },
    { icon: "\uD83D\uDCCA", title: "Fleet Monitoring & Alerts", desc: "Real-time fleet dashboard with comparison tables, CSV export, and proactive email/webhook alerts for node offline, storage critical, Jellyfin down, and sync failures." },
    { icon: "\uD83D\uDD12", title: "Multi-Tenant & Secure", desc: "Row-level security, role-based access (6 roles), enrollment tokens, permanent device codes, remote diagnostics with log sanitization. Each school sees only their own data." },
    { icon: "\u267F", title: "Accessible Student Player", desc: "Self-contained classroom player with font size control, high contrast mode, sequence progress indicators, fixed quiz timers, and letter-prefixed MCQ buttons. EN/PT/ES." },
    { icon: "\uD83D\uDD04", title: "Auto-Sync, Backup & Updates", desc: "Content syncs with checksum verification. Auto-backup every 6 hours with integrity checks. Software updates respect configurable maintenance windows." },
  ];
  return <Section id="features"><div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Features</div><h2 style={{ marginTop: 12, fontSize: 48, lineHeight: 1.06, color: BRAND.text }}>Everything Schools Need to Deliver and Assess</h2><p style={{ marginTop: 14, maxWidth: 860, color: BRAND.muted, fontSize: 18, lineHeight: 1.8 }}>Schedule, deliver, assess, and monitor — from cloud dashboard to classroom player. Fully offline-capable.</p><div className="p-grid-four" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18 }}>{items.map(f => <Glass key={f.title} className="if-card-hover" style={{ padding: 24 }}><div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div><div style={{ fontSize: 18, fontWeight: 700, color: BRAND.text, marginBottom: 8 }}>{f.title}</div><p style={{ color: BRAND.muted, lineHeight: 1.75, fontSize: 14 }}>{f.desc}</p></Glass>)}</div></Section>;
}

function HowItWorks() {
  const steps = [
    { step: "01", title: "Upload & Schedule", desc: "Upload video lessons to the cloud or use the Quick Lesson wizard. Schedule classes on the weekly calendar — assign a sequence, class group, and classroom. Content syncs to the node automatically.", color: BRAND.orange },
    { step: "02", title: "Sync & Ready", desc: "The sync worker downloads packages, verifies SHA-256 checksums, and registers with Pulse. Pre-class readiness indicators show green when content is on the node and ready to play.", color: BRAND.amber },
    { step: "03", title: "Learn & Assess", desc: "STBs auto-load the scheduled lesson. Students watch videos, then Pulse hands off to CORE for personalized quizzes. Offline? Pulse serves a local 3-MCQ fallback. All results sync when connectivity returns.", color: "#10b981" },
  ];
  return <Section id="how-it-works" style={{ background: "rgba(255,255,255,0.02)" }}><div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>How it works</div><h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Three Steps from Upload to Assessment</h2><div className="p-grid-three" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 }}>{steps.map(s => <div key={s.step}><div style={{ fontSize: 64, fontWeight: 900, color: s.color, opacity: 0.3, lineHeight: 1 }}>{s.step}</div><h3 style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: BRAND.text }}>{s.title}</h3><p style={{ marginTop: 12, color: BRAND.muted, lineHeight: 1.8, fontSize: 15 }}>{s.desc}</p></div>)}</div></Section>;
}

function Architecture() {
  return <Section id="architecture"><div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Architecture</div><h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Built for Resilience</h2><p style={{ marginTop: 14, maxWidth: 860, color: BRAND.muted, fontSize: 18, lineHeight: 1.8 }}>A split architecture that keeps schools running even when the internet doesn&apos;t.</p><div className="p-grid-two" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}><Glass className="if-card-hover" style={{ padding: 28, background: "rgba(242,101,34,0.08)", borderColor: "rgba(242,101,34,0.2)" }}><div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Cloud (Vercel + Supabase)</div><div style={{ marginTop: 20, display: "grid", gap: 14 }}>{["50+ page dashboard — scheduling, curriculum, analytics, quick lesson wizard", "Classroom schedule calendar with recurring classes and readiness indicators", "Proactive alerting — email and webhook notifications for critical events", "Fleet comparison table with sorting, filtering, and CSV export", "45+ REST API endpoints with rate limiting, RLS, and multi-tenant isolation"].map(line => <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><div style={{ width: 8, height: 8, borderRadius: 999, background: "#f59e0b", marginTop: 6, flexShrink: 0 }} /><div style={{ color: BRAND.text, lineHeight: 1.7, fontSize: 14 }}>{line}</div></div>)}</div></Glass><Glass className="if-card-hover" style={{ padding: 28, background: "rgba(232,76,30,0.08)", borderColor: "rgba(232,76,30,0.2)" }}><div style={{ color: "#f26522", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>School Node (On-Prem)</div><div style={{ marginTop: 20, display: "grid", gap: 14 }}>{["Schedule-aware STB auto-load — content starts when the class arrives", "Lesson-complete events hand off to CORE for formative quizzes", "Accessible classroom player with font scaling, high contrast, and i18n", "Mobile teacher conductor with swipe gestures and live session stats", "Auto-backup with integrity verification, remote diagnostics, maintenance windows"].map(line => <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><div style={{ width: 8, height: 8, borderRadius: 999, background: "#f26522", marginTop: 6, flexShrink: 0 }} /><div style={{ color: BRAND.text, lineHeight: 1.7, fontSize: 14 }}>{line}</div></div>)}</div></Glass></div></Section>;
}

function ClassroomDemoSection() {
  return <Section id="classroom-demo" style={{ background: "rgba(255,255,255,0.02)" }}><div style={{ textAlign: "center", marginBottom: 32 }}><div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Interactive Demo</div><h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Experience the Classroom</h2><p style={{ marginTop: 14, maxWidth: 700, color: BRAND.muted, fontSize: 18, lineHeight: 1.85, marginInline: "auto" }}>Walk through a real student experience — watch a video, take a CORE quiz, try a Spark prediction, and see your results.</p></div><PulseClassroomSimulator /></Section>;
}

function PlatformSection() {
  return <Section id="platform" style={{ overflow: "hidden" }}><Glow left={-40} top={-10} size={220} from={PULSE_GLOW.from} to={PULSE_GLOW.to} opacity={0.16} /><Glass className="if-card-hover" style={{ padding: 34, position: "relative", overflow: "hidden" }}><div style={{ position: "relative", zIndex: 2 }}><div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Part of the Inteliflow Ecosystem</div><h2 style={{ marginTop: 12, fontSize: 42, lineHeight: 1.08, color: BRAND.text }}>Pulse Works Better With the Full Ecosystem</h2><p style={{ marginTop: 14, maxWidth: 900, color: BRAND.muted, fontSize: 18, lineHeight: 1.85 }}>Pulse handles content delivery and classroom scheduling. When a lesson ends, it hands off to CORE for formative assessment. Combined with LIFT (admissions) and SPARK (discovery), you get a complete connected learning ecosystem.</p><div className="p-grid-four" style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>{[{ name: "LIFT", desc: "Admissions & Placement", color: "#6ee7b7" }, { name: "CORE", desc: "Classroom Learning", color: "#a78bfa" }, { name: "SPARK", desc: "Hands-On Discovery", color: "#f97316" }, { name: "PULSE", desc: "Content Delivery", color: BRAND.orange, active: true }].map(p => <Glass key={p.name} style={{ padding: 20, textAlign: "center", background: (p as any).active ? "rgba(242,101,34,0.15)" : BRAND.cardStrong, borderColor: (p as any).active ? "rgba(242,101,34,0.3)" : BRAND.line }}><div style={{ fontSize: 24, fontWeight: 800, color: p.color }}>{p.name}</div><div style={{ fontSize: 12, color: BRAND.muted, marginTop: 6 }}>{p.desc}</div></Glass>)}</div><div className="p-hero-btns" style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}><a href="https://inteliflowai.com" style={{ padding: "16px 22px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 10px 30px rgba(242,101,34,0.35)" }}>Explore the Full Ecosystem</a><a href="https://inteliflowai.com/admissions/" style={{ padding: "16px 22px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 700 }}>Visit LIFT</a><a href="https://app.inteliflowai.com/core/" style={{ padding: "16px 22px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 700 }}>Visit CORE</a></div></div></Glass></Section>;
}

function ContactForm() {
  return <Section id="contact" style={{ paddingBottom: 16 }}><Glass className="if-card-hover" style={{ padding: 38, position: "relative", overflow: "hidden" }}><Glow left={-20} top={-20} size={180} from={BRAND.orange} to={BRAND.amber} /><Glow right={-20} bottom={-20} size={220} from={BRAND.deepOrange} to={BRAND.amber} /><div style={{ position: "relative", zIndex: 2 }}><div style={{ textAlign: "center" }}><div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Get started</div><h2 style={{ marginTop: 12, fontSize: 42, lineHeight: 1.08, color: BRAND.text }}>Ready to Bring Learning Infrastructure to Your Schools?</h2><p style={{ marginTop: 14, color: BRAND.muted, fontSize: 18, lineHeight: 1.85, maxWidth: 700, marginInline: "auto" }}>Tell us about your school and we&apos;ll show you how Pulse can work for you.</p></div><form style={{ marginTop: 28, maxWidth: 520, marginInline: "auto", display: "grid", gap: 14 }} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const subject = encodeURIComponent("Pulse Inquiry: " + (fd.get("school") || "New School")); const body = encodeURIComponent("Name: " + fd.get("name") + "\nSchool: " + fd.get("school") + "\nEmail: " + fd.get("email") + "\nRole: " + fd.get("role") + "\n\nMessage:\n" + fd.get("message")); window.location.href = "mailto:info@inteliflowai.com?subject=" + subject + "&body=" + body; }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><input name="name" placeholder="Full Name" required style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }} /><input name="email" type="email" placeholder="Work Email" required style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }} /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><input name="school" placeholder="School / Organization" required style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }} /><select name="role" style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }}><option value="">Your Role</option><option value="School Leader">School Leader</option><option value="IT Director">IT Director</option><option value="Teacher">Teacher</option><option value="District Admin">District Admin</option><option value="Other">Other</option></select></div><textarea name="message" placeholder="Tell us about your school and what you're looking for..." rows={4} style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14, resize: "vertical" }} /><button type="submit" style={{ padding: "16px 24px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`, color: BRAND.white, fontWeight: 800, border: "none", cursor: "pointer", fontSize: 15, boxShadow: "0 10px 30px rgba(242,101,34,0.35)" }}>Request a Demo</button><p style={{ textAlign: "center", fontSize: 12, color: BRAND.muted, margin: 0 }}>No commitment. We&apos;ll reach out within 24 hours.</p></form><div className="p-hero-btns" style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}><a href="/api-docs" style={{ padding: "14px 22px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 700 }}>API Documentation</a></div></div></Glass></Section>;
}

function Footer() {
  return (
    <footer style={{ background: BRAND.bg, borderTop: `1px solid ${BRAND.line}`, padding: "48px 24px" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <img src="/pulse-logo.png" alt="Pulse" style={{ height: 56 }} />
        <p style={{ fontSize: 14, color: BRAND.muted, textAlign: "center" }}>
          Learning intelligence for classroom delivery.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: `${BRAND.muted}88` }}>An</span>
          <img src="/inteliflow-logo.jpg" alt="Inteliflow" style={{ height: 28, borderRadius: 4 }} />
          <span style={{ fontSize: 12, color: `${BRAND.muted}88` }}>product</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: BRAND.muted }}>
          <a href="/privacy" style={{ color: BRAND.muted, textDecoration: "underline", textUnderlineOffset: 3 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: BRAND.muted, textDecoration: "underline", textUnderlineOffset: 3 }}>Terms of Service</a>
          <a href="/api-docs" style={{ color: BRAND.muted, textDecoration: "underline", textUnderlineOffset: 3 }}>API Docs</a>
        </div>
        <a href="mailto:info@inteliflowai.com" style={{ fontSize: 14, color: BRAND.orange, fontWeight: 500 }}>
          info@inteliflowai.com
        </a>
        <p style={{ fontSize: 12, color: `${BRAND.muted}66`, textAlign: "center" }}>
          &copy; 2026 Inteliflow &middot; Pulse is a learning delivery infrastructure platform
        </p>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function PulseLandingPage() {
  useEffect(() => {
    document.title = "Pulse — Learning Intelligence for Classroom Delivery | Inteliflow";

    const id = "pulse-landing-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .pulse-app,.pulse-app *{box-sizing:border-box}
      .pulse-app a{text-decoration:none}
      .pulse-app img{max-width:100%;height:auto;display:block}
      .pulse-container{width:min(1280px,calc(100% - 40px));margin:0 auto}
      .pulse-section{position:relative;padding:40px 0}
      .pulse-section:first-of-type{padding-top:20px}
      .pulse-section:last-of-type{padding-bottom:20px}
      .if-card-hover{transition:transform .35s ease,box-shadow .35s ease,border-color .35s ease}
      .if-card-hover:hover{transform:translateY(-5px);box-shadow:0 26px 70px rgba(18,8,0,.42);border-color:rgba(255,255,255,.22)}
      @keyframes pulse-float{0%{transform:translateY(0)}50%{transform:translateY(-8px)}100%{transform:translateY(0)}}
      @keyframes pulse-glow{0%{opacity:.1;transform:scale(1)}50%{opacity:.2;transform:scale(1.05)}100%{opacity:.1;transform:scale(1)}}
      .p-float{animation:pulse-float 9s ease-in-out infinite}
      .p-glow{animation:pulse-glow 8s ease-in-out infinite}
      @media(max-width:1024px){.p-grid-hero,.p-grid-two{grid-template-columns:1fr !important}.p-grid-three,.p-grid-four{grid-template-columns:1fr 1fr !important}}
      @media(max-width:720px){.pulse-container{width:calc(100% - 32px)}.p-grid-three,.p-grid-four{grid-template-columns:1fr !important}.p-title{font-size:42px !important;line-height:1.04 !important}.pulse-section{padding:32px 0 !important}.p-hero-btns{flex-direction:column !important;align-items:stretch !important}.p-hero-btns a{width:100% !important;text-align:center !important}header .pulse-container,footer .pulse-container{width:calc(100% - 32px)}}
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="pulse-app" style={{
      fontFamily: "'DM Sans',system-ui,sans-serif",
      minHeight: "100vh", width: "100%", color: BRAND.text,
      background: `
        radial-gradient(circle at 10% 10%, rgba(242,101,34,0.18), transparent 22%),
        radial-gradient(circle at 86% 12%, rgba(245,158,11,0.14), transparent 18%),
        radial-gradient(circle at 45% 78%, rgba(242,101,34,0.12), transparent 22%),
        linear-gradient(180deg, ${BRAND.bg} 0%, ${BRAND.bg2} 46%, ${BRAND.bg3} 100%)
      `,
    }}>
      <Header />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <Architecture />
      <ClassroomDemoSection />
      <PlatformSection />
      <ContactForm />
      <Footer />
    </div>
  );
}
