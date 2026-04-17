import React, { useState, useEffect } from "react";

const B = {
  bg: "#120800", text: "#fff4eb", muted: "#d4a574",
  orange: "#f26522", deepOrange: "#e84c1e", amber: "#f59e0b",
  emerald: "#10b981", red: "#ef4444", blue: "#3b82f6",
  line: "rgba(242,101,34,0.25)", card: "rgba(18,8,0,0.88)",
};

const glass = {
  background: B.card,
  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${B.line}`,
  borderRadius: 16,
  fontFamily: "'DM Sans',system-ui,sans-serif",
  color: B.text,
};

const pill = (color) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600,
  background: `${color}22`, color, border: `1px solid ${color}44`,
});

const dot = (color, size = 7) => ({
  width: size, height: size, borderRadius: 999, background: color, flexShrink: 0,
});

function StatusDot({ color }) {
  return <span style={dot(color)} />;
}

/* ─── SCREEN 1: Cloud Dashboard ─── */
function DashboardScreen() {
  const nodes = [
    { name: "Node A — Library", status: "Online", devices: 12, cpu: "23%", online: true },
    { name: "Node B — Science Lab", status: "Online", devices: 8, cpu: "45%", online: true },
    { name: "Node C — Sports Hall", status: "Offline", devices: 0, cpu: "—", online: false },
  ];
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Westview Academy</div>
      <div style={{ fontSize: 11, color: B.muted, marginBottom: 16 }}>3 Nodes Online</div>
      <div style={{ display: "grid", gap: 8 }}>
        {nodes.map((n) => (
          <div key={n.name} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
            <StatusDot color={n.online ? B.emerald : B.red} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: B.text, fontSize: 12 }}>{n.name}</div>
              {n.online
                ? <div style={{ color: B.muted, marginTop: 2 }}>{n.devices} devices · CPU {n.cpu}</div>
                : <div style={{ color: B.red, marginTop: 2, fontSize: 10 }}>Syncing when back online</div>
              }
            </div>
            <span style={pill(n.online ? B.emerald : B.red)}>{n.status}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 10, color: B.muted, textAlign: "center" }}>
        48 assets synced · 12 sequences published · 3 active classrooms
      </div>
    </div>
  );
}

/* ─── SCREEN 2: Classroom Player ─── */
function ClassroomScreen() {
  return (
    <div style={{ padding: 20 }}>
      {/* Video player area */}
      <div style={{ background: "#0a0500", borderRadius: 10, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(242,101,34,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 18, marginLeft: 3, color: "#fff" }}>&#9654;</span>
        </div>
        {/* Progress bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.1)" }}>
          <div style={{ width: "67%", height: "100%", background: B.orange, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cell Division: Mitosis & Meiosis</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <span style={pill(B.blue)}>Biology</span>
        <span style={pill(B.amber)}>Grade 9</span>
      </div>
      <div style={{ fontSize: 11, color: B.muted, marginBottom: 6 }}>Part 2 of 4 in today's sequence</div>
      <div style={{ fontSize: 11, color: B.orange, marginBottom: 12 }}>&#8594; Quiz: Cell Division (after this video)</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: B.muted }}>Jordan Kim · Room 204</div>
        <span style={pill(B.emerald)}>Offline ready &#10003;</span>
      </div>
    </div>
  );
}

/* ─── SCREEN 3: Sequence Builder ─── */
function SequenceScreen() {
  const items = [
    { icon: "\uD83D\uDCF9", title: "Introduction to Mitosis", meta: "12 min", done: true },
    { icon: "\u2753", title: "Mitosis Basics", meta: "5 questions · CORE", done: true },
    { icon: "\uD83D\uDCF9", title: "Meiosis & Genetic Variation", meta: "15 min", playing: true },
    { icon: "\u26A1", title: "Chromosome Sorting", meta: "Spark", upcoming: true },
    { icon: "\uD83D\uDCF9", title: "Cell Cycle Regulation", meta: "10 min", upcoming: true },
    { icon: "\u2753", title: "Full Unit Assessment", meta: "CORE", upcoming: true },
  ];
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Cell Biology Unit — Week 3</div>
      <div style={{ fontSize: 11, color: B.muted, marginBottom: 14 }}>Learning Sequence</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, fontSize: 11,
            background: it.playing ? "rgba(242,101,34,0.12)" : "rgba(255,255,255,0.03)",
            border: it.playing ? `1px solid ${B.line}` : "1px solid transparent",
          }}>
            <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{it.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: it.upcoming ? B.muted : B.text, fontSize: 12 }}>{it.title}</div>
              <div style={{ color: B.muted, marginTop: 1, fontSize: 10 }}>{it.meta}</div>
            </div>
            {it.done && <span style={{ color: B.emerald, fontSize: 12, fontWeight: 700 }}>&#10003;</span>}
            {it.playing && <span style={pill(B.orange)}>&#9654; Playing</span>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: B.muted, textAlign: "center" }}>
        Assigned to: Grade 9 Biology · Rooms 201, 204
      </div>
    </div>
  );
}

/* ─── SCREEN 4: Conductor Mode ─── */
function ConductorScreen() {
  const students = [
    { init: "JK", status: "watching", pct: "67%" },
    { init: "AL", status: "watching", pct: "54%" },
    { init: "MR", status: "completed" },
    { init: "TS", status: "watching", pct: "72%" },
    { init: "NP", status: "watching", pct: "61%" },
    { init: "RD", status: "completed" },
    { init: "KW", status: "watching", pct: "45%" },
    { init: "BJ", status: "paused" },
    { init: "LM", status: "watching", pct: "80%" },
    { init: "SC", status: "watching", pct: "58%" },
    { init: "AH", status: "watching", pct: "63%" },
    { init: "YZ", status: "watching", pct: "70%" },
  ];
  const statusColor = { watching: B.blue, completed: B.emerald, paused: B.amber };
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Live Session</div>
        <span style={pill(B.emerald)}>24 connected</span>
      </div>
      <div style={{ fontSize: 11, color: B.muted, marginBottom: 12 }}>Room 204 · Meiosis & Genetic Variation</div>

      {/* Student grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
        {students.map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: `${statusColor[s.status]}22`, color: statusColor[s.status], display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{s.init}</div>
            <div style={{ color: B.muted, fontSize: 9 }}>{s.status === "completed" ? "done ✓" : s.status === "paused" ? "paused" : s.pct}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {["⏸ Pause All", "⏭ Next", "📊 Live Results"].map((label) => (
          <div key={label} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 10, fontWeight: 600, color: B.text }}>{label}</div>
        ))}
      </div>
      <div style={{ background: "rgba(242,101,34,0.1)", border: `1px solid ${B.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 10, color: B.orange }}>
        3 students completed early — auto-advancing to quiz
      </div>
    </div>
  );
}

/* ─── Main Demo Component ─── */
const SCREENS = [
  { label: "Cloud Dashboard", component: DashboardScreen },
  { label: "Classroom Player", component: ClassroomScreen },
  { label: "Sequence Builder", component: SequenceScreen },
  { label: "Conductor Mode", component: ConductorScreen },
];

export default function PulseAnimatedDemo() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % SCREENS.length);
        setVisible(true);
      }, 380);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const Screen = SCREENS[current].component;

  return (
    <div style={{ maxWidth: 520, width: "100%", margin: "0 auto" }}>
      <div style={{ ...glass, overflow: "hidden" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          {SCREENS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => { setVisible(false); setTimeout(() => { setCurrent(i); setVisible(true); }, 380); }}
              style={{
                flex: 1, padding: "10px 4px", border: "none", cursor: "pointer",
                background: i === current ? "rgba(242,101,34,0.12)" : "transparent",
                borderBottom: i === current ? `2px solid ${B.orange}` : "2px solid transparent",
                color: i === current ? B.orange : B.muted,
                fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans',system-ui,sans-serif",
                transition: "all .2s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Screen content with crossfade */}
        <div style={{ opacity: visible ? 1 : 0, transition: "opacity 380ms ease-in-out", minHeight: 340 }}>
          <Screen />
        </div>
      </div>
    </div>
  );
}
