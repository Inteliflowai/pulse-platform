import React, { useEffect } from "react";
import PulseAnimatedDemo from "./components/PulseAnimatedDemo";
import PulseClassroomSimulator from "./components/PulseClassroomSimulator";

const ASSET_BASE = "/wp-content/reactpress/apps/pulse-marketing";
const IMG = (file) => `${ASSET_BASE}/images/${encodeURIComponent(file)}`;

/* ─── PULSE Brand Tokens (derived from the Pulse logo) ──── */
const BRAND = {
  bg: "#120800",
  bg2: "#1f0e00",
  bg3: "#2e1800",
  white: "#ffffff",
  text: "#fff4eb",
  muted: "#d4a574",
  line: "rgba(255,255,255,0.14)",
  card: "rgba(255,255,255,0.07)",
  cardStrong: "rgba(255,255,255,0.14)",
  orange: "#f26522",
  deepOrange: "#e84c1e",
  amber: "#f59e0b",
  brown: "#6b3a1f",
  warmRed: "#d4451a",
  emerald: "#10b981",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  mint: "#ffb380",
  shadow: "0 24px 80px rgba(18, 8, 0, 0.50)",
};

const PULSE_GLOW = { from: "#f26522", to: "#e84c1e" };

const pulseLogo = `${IMG("pulse-logo.png")}?v=2`;

function usePageStyles() {
  useEffect(() => {
    const id = "pulse-marketing-scoped-styles";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;

    style.innerHTML = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100%;
        min-height: 100%;
        background: #120800 !important;
        overflow-x: hidden !important;
        scroll-behavior: smooth;
      }

      #root {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }

      .wp-site-blocks,
      .wp-site-blocks > *,
      .entry-content,
      .page-content,
      .post-content,
      .wp-block-post-content,
      .is-layout-constrained,
      .is-layout-flow,
      .alignfull,
      main,
      .site-content,
      .content-area,
      .site-main,
      .wp-block-group,
      .wp-block-columns {
        margin: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        max-width: 100% !important;
      }

      .wp-site-blocks {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }

      .wp-site-blocks > main {
        margin-top: 0 !important;
      }

      .wp-site-blocks > main > .wp-block-group {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }

      .wp-site-blocks > footer.wp-block-template-part {
        display: none !important;
      }

      .wp-site-blocks > main .has-global-padding {
        padding: 0 !important;
      }

      .wp-block-post-title,
      h1.entry-title,
      h1.wp-block-post-title,
      .page-title {
        display: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      body > div {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }

      .pulse-breakout {
        position: relative;
        left: 50%;
        right: 50%;
        margin-left: -50vw;
        margin-right: -50vw;
        width: 100vw;
        max-width: 100vw;
        overflow-x: hidden;
      }

      .pulse-app {
        position: relative;
        min-height: 100vh;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        color: ${BRAND.text};
      }

      .pulse-app,
      .pulse-app * {
        box-sizing: border-box;
      }

      .pulse-app a {
        text-decoration: none;
      }

      .pulse-app img {
        max-width: 100%;
        height: auto;
        display: block;
      }

      .pulse-shell {
        width: 100%;
      }

      .pulse-container {
        width: min(1280px, calc(100% - 40px));
        margin: 0 auto;
      }

      .pulse-section {
        position: relative;
        padding: 40px 0;
      }

      .pulse-section:first-of-type {
        padding-top: 20px;
      }

      .pulse-section:last-of-type {
        padding-bottom: 20px;
      }

      .if-card-hover {
        transition: transform .35s ease, box-shadow .35s ease, border-color .35s ease;
      }

      .if-card-hover:hover {
        transform: translateY(-5px);
        box-shadow: 0 26px 70px rgba(18,8,0,.42);
        border-color: rgba(255,255,255,.22);
      }

      @keyframes pulse-float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
        100% { transform: translateY(0px); }
      }

      @keyframes pulse-glow {
        0% { opacity: .10; transform: scale(1); }
        50% { opacity: .20; transform: scale(1.05); }
        100% { opacity: .10; transform: scale(1); }
      }

      .p-float { animation: pulse-float 9s ease-in-out infinite; }
      .p-glow { animation: pulse-glow 8s ease-in-out infinite; }

      @media (max-width: 1024px) {
        .p-grid-hero, .p-grid-two {
          grid-template-columns: 1fr !important;
        }

        .p-grid-three, .p-grid-four {
          grid-template-columns: 1fr 1fr !important;
        }
      }

      @media (max-width: 720px) {
        .pulse-container {
          width: calc(100% - 32px);
        }

        .p-grid-three, .p-grid-four {
          grid-template-columns: 1fr !important;
        }

        .p-title {
          font-size: 42px !important;
          line-height: 1.04 !important;
        }

        .pulse-section {
          padding: 32px 0 !important;
        }

        .p-hero-btns {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .p-hero-btns a {
          width: 100% !important;
          text-align: center !important;
        }

        header .pulse-container,
        footer .pulse-container {
          width: calc(100% - 32px);
        }
      }
    `;

    document.head.appendChild(style);
  }, []);
}

function Section({ id, children, style = {}, fullWidth = false }) {
  return (
    <section id={id} className="pulse-section" style={style}>
      {fullWidth ? children : <div className="pulse-container">{children}</div>}
    </section>
  );
}

function Glass({ children, style = {}, className = "" }) {
  return (
    <div
      className={className}
      style={{
        background: BRAND.card,
        border: `1px solid ${BRAND.line}`,
        borderRadius: 28,
        boxShadow: BRAND.shadow,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Glow({ left, right, top, bottom, size = 240, from = BRAND.orange, to = BRAND.deepOrange, opacity = 0.18 }) {
  return (
    <div
      className="p-glow"
      style={{
        position: "absolute",
        left,
        right,
        top,
        bottom,
        width: size,
        height: size,
        borderRadius: 999,
        background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
        filter: "blur(60px)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

function Header() {
  return (
    <header
      style={{
        position: "relative",
        zIndex: 50,
        background: "rgba(18,8,0,0.85)",
        borderBottom: `1px solid ${BRAND.line}`,
        backdropFilter: "blur(16px)",
      }}
    >
      <div
        className="pulse-container"
        style={{
          padding: "16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="https://inteliflowai.com" title="Back to Inteliflow" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card, color: BRAND.muted, fontSize: 18, textDecoration: "none", flexShrink: 0 }}>&larr;</a>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={pulseLogo} alt="Pulse" style={{ height: 60, width: "auto", objectFit: "contain" }} />
          </a>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a href="#features" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Features</a>
          <a href="#how-it-works" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>How It Works</a>
          <a href="#architecture" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Architecture</a>
          <a href="#platform" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Platform</a>
          <a
            href="#contact"
            style={{
              padding: "14px 18px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`,
              color: BRAND.white,
              fontWeight: 800,
              boxShadow: "0 10px 30px rgba(242,101,34,0.35)",
            }}
          >
            Contact Us
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <Section id="top" style={{ paddingTop: 16, paddingBottom: 24, overflow: "hidden" }}>
      <Glow left={-60} top={10} size={300} from={PULSE_GLOW.from} to={PULSE_GLOW.to} />
      <Glow right={-50} top={40} size={260} from={BRAND.amber} to={BRAND.warmRed} />

      <div className="p-grid-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 36, alignItems: "center" }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.08)",
              border: `1px solid ${BRAND.line}`,
              borderRadius: 999,
              padding: "6px 16px",
              marginBottom: 24,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981", animation: "pulse-glow 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, color: BRAND.muted }}>Part of the Inteliflow Learning Ecosystem</span>
          </div>

          <h1 className="p-title" style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: -2.8, color: BRAND.text, margin: 0 }}>
            Learning Intelligence
            <br />
            <span
              style={{
                background: `linear-gradient(135deg, ${PULSE_GLOW.from}, ${PULSE_GLOW.to})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              for classroom delivery
            </span>
          </h1>

          <p style={{ marginTop: 16, fontSize: 26, lineHeight: 1.3, color: BRAND.text, fontWeight: 600, maxWidth: 680, letterSpacing: -0.5 }}>
            Built on pedagogy. Powered by AI.
          </p>

          <p style={{ marginTop: 16, fontSize: 19, lineHeight: 1.7, color: BRAND.muted, maxWidth: 660 }}>
            Curriculum, video, and formative checks orchestrated in real time — online or offline, cloud or on-premises.
          </p>

          <div className="p-hero-btns" style={{ marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a
              href="#contact"
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`,
                color: BRAND.white,
                fontWeight: 800,
                boxShadow: "0 12px 30px rgba(242,101,34,0.35)",
              }}
            >
              Get Started
            </a>

            <a
              href="#how-it-works"
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                border: `1px solid ${BRAND.line}`,
                background: BRAND.cardStrong,
                color: BRAND.text,
                fontWeight: 700,
              }}
            >
              See How It Works
            </a>

            <a
              href="#classroom-demo"
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                border: `1px solid ${BRAND.line}`,
                background: BRAND.cardStrong,
                color: BRAND.text,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Try Classroom Demo
            </a>
          </div>
        </div>

        <PulseAnimatedDemo />
      </div>
    </Section>
  );
}

function StatsBar() {
  return (
    <div style={{ borderTop: `1px solid ${BRAND.line}`, borderBottom: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.03)" }}>
      <div
        className="pulse-container"
        style={{
          padding: "36px 0",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          textAlign: "center",
        }}
      >
        {[
          { value: "50+", label: "Dashboard Pages" },
          { value: "100%", label: "Offline Capable" },
          { value: "3", label: "Languages" },
          { value: "45+", label: "API Endpoints" },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 36, fontWeight: 800, color: BRAND.text }}>{s.value}</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Features() {
  const items = [
    { icon: "⚡", title: "Offline-First Delivery", desc: "Content syncs to on-prem nodes and plays locally. No internet? No problem. Students never see a loading spinner. Lesson completions queue locally and sync when WAN returns." },
    { icon: "📅", title: "Classroom Scheduling", desc: "Schedule which class watches which content in which room at what time. STBs auto-load content when the next class arrives. Supports recurring, daily, and weekly schedules." },
    { icon: "🎓", title: "Mobile Teacher Conductor", desc: "Teachers control classrooms from any device. Mobile-first conductor with swipe navigation, live stats, and a 3-step Quick Lesson wizard to go from video to scheduled class in under a minute." },
    { icon: "🧠", title: "CORE Quiz Handoff", desc: "When a video ends, Pulse fires a lesson-complete event. CORE delivers personalized quizzes matched to mastery. Offline fallback serves 3 MCQ when CORE is unreachable." },
    { icon: "📊", title: "Fleet Monitoring & Alerts", desc: "Real-time fleet dashboard with comparison tables, CSV export, and proactive email/webhook alerts for node offline, storage critical, Jellyfin down, and sync failures." },
    { icon: "🔒", title: "Multi-Tenant & Secure", desc: "Row-level security, role-based access (6 roles), enrollment tokens, permanent device codes, remote diagnostics with log sanitization. Each school sees only their own data." },
    { icon: "♿", title: "Accessible Student Player", desc: "Self-contained classroom player with font size control, high contrast mode, sequence progress indicators, fixed quiz timers, and letter-prefixed MCQ buttons. EN/PT/ES." },
    { icon: "🔄", title: "Auto-Sync, Backup & Updates", desc: "Content syncs with checksum verification. Auto-backup every 6 hours with integrity checks. Software updates respect configurable maintenance windows." },
  ];

  return (
    <Section id="features">
      <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Features</div>
      <h2 style={{ marginTop: 12, fontSize: 48, lineHeight: 1.06, color: BRAND.text }}>Everything Schools Need to Deliver and Assess</h2>
      <p style={{ marginTop: 14, maxWidth: 860, color: BRAND.muted, fontSize: 18, lineHeight: 1.8 }}>
        Schedule, deliver, assess, and monitor — from cloud dashboard to classroom player. Fully offline-capable.
      </p>

      <div className="p-grid-four" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18 }}>
        {items.map((f) => (
          <Glass key={f.title} className="if-card-hover" style={{ padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BRAND.text, marginBottom: 8 }}>{f.title}</div>
            <p style={{ color: BRAND.muted, lineHeight: 1.75, fontSize: 14 }}>{f.desc}</p>
          </Glass>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { step: "01", title: "Upload & Schedule", desc: "Upload video lessons to the cloud or use the Quick Lesson wizard. Schedule classes on the weekly calendar — assign a sequence, class group, and classroom. Content syncs to the node automatically.", color: BRAND.orange },
    { step: "02", title: "Sync & Ready", desc: "The sync worker downloads packages, verifies SHA-256 checksums, and registers with Pulse. Pre-class readiness indicators show green when content is on the node and ready to play.", color: BRAND.amber },
    { step: "03", title: "Learn & Assess", desc: "STBs auto-load the scheduled lesson. Students watch videos, then Pulse hands off to CORE for personalized quizzes. Offline? Pulse serves a local 3-MCQ fallback. All results sync when connectivity returns.", color: "#10b981" },
  ];

  return (
    <Section id="how-it-works" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>How it works</div>
      <h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Three Steps from Upload to Assessment</h2>

      <div className="p-grid-three" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 }}>
        {steps.map((s) => (
          <div key={s.step}>
            <div style={{ fontSize: 64, fontWeight: 900, color: s.color, opacity: 0.3, lineHeight: 1 }}>{s.step}</div>
            <h3 style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: BRAND.text }}>{s.title}</h3>
            <p style={{ marginTop: 12, color: BRAND.muted, lineHeight: 1.8, fontSize: 15 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Architecture() {
  return (
    <Section id="architecture">
      <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Architecture</div>
      <h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Built for Resilience</h2>
      <p style={{ marginTop: 14, maxWidth: 860, color: BRAND.muted, fontSize: 18, lineHeight: 1.8 }}>
        A split architecture that keeps schools running even when the internet doesn&apos;t.
      </p>

      <div className="p-grid-two" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Glass className="if-card-hover" style={{ padding: 28, background: "rgba(242,101,34,0.08)", borderColor: "rgba(242,101,34,0.2)" }}>
          <div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Cloud (Vercel + Supabase)</div>
          <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
            {[
              "50+ page dashboard — scheduling, curriculum, analytics, quick lesson wizard",
              "Classroom schedule calendar with recurring classes and readiness indicators",
              "Proactive alerting — email and webhook notifications for critical events",
              "Fleet comparison table with sorting, filtering, and CSV export",
              "45+ REST API endpoints with rate limiting, RLS, and multi-tenant isolation",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "#f59e0b", marginTop: 6, flexShrink: 0 }} />
                <div style={{ color: BRAND.text, lineHeight: 1.7, fontSize: 14 }}>{line}</div>
              </div>
            ))}
          </div>
        </Glass>

        <Glass className="if-card-hover" style={{ padding: 28, background: "rgba(232,76,30,0.08)", borderColor: "rgba(232,76,30,0.2)" }}>
          <div style={{ color: "#f26522", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>School Node (On-Prem)</div>
          <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
            {[
              "Schedule-aware STB auto-load — content starts when the class arrives",
              "Lesson-complete events hand off to CORE for formative quizzes",
              "Accessible classroom player with font scaling, high contrast, and i18n",
              "Mobile teacher conductor with swipe gestures and live session stats",
              "Auto-backup with integrity verification, remote diagnostics, maintenance windows",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "#f26522", marginTop: 6, flexShrink: 0 }} />
                <div style={{ color: BRAND.text, lineHeight: 1.7, fontSize: 14 }}>{line}</div>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    </Section>
  );
}

function ClassroomDemo() {
  return (
    <Section id="classroom-demo" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Interactive Demo</div>
        <h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Experience the Classroom</h2>
        <p style={{ marginTop: 14, maxWidth: 700, color: BRAND.muted, fontSize: 18, lineHeight: 1.85, marginInline: "auto" }}>
          Walk through a real student experience — watch a video, take a CORE quiz, try a Spark prediction, and see your results.
        </p>
      </div>
      <PulseClassroomSimulator />
    </Section>
  );
}

function PlatformSection() {
  return (
    <Section id="platform" style={{ overflow: "hidden" }}>
      <Glow left={-40} top={-10} size={220} from={PULSE_GLOW.from} to={PULSE_GLOW.to} opacity={0.16} />

      <Glass className="if-card-hover" style={{ padding: 34, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Part of the Inteliflow Ecosystem</div>
          <h2 style={{ marginTop: 12, fontSize: 42, lineHeight: 1.08, color: BRAND.text }}>Pulse Works Better With the Full Ecosystem</h2>
          <p style={{ marginTop: 14, maxWidth: 900, color: BRAND.muted, fontSize: 18, lineHeight: 1.85 }}>
            Pulse handles content delivery and classroom scheduling. When a lesson ends, it hands off to CORE for formative assessment. Combined with LIFT (admissions) and SPARK (discovery), you get a complete connected learning ecosystem.
          </p>

          <div className="p-grid-four" style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            {[
              { name: "LIFT", desc: "Admissions & Placement", color: "#6ee7b7" },
              { name: "CORE", desc: "Classroom Learning", color: "#a78bfa" },
              { name: "SPARK", desc: "Hands-On Discovery", color: "#f97316" },
              { name: "PULSE", desc: "Content Delivery", color: BRAND.orange, active: true },
            ].map((p) => (
              <Glass
                key={p.name}
                style={{
                  padding: 20,
                  textAlign: "center",
                  background: p.active ? "rgba(242,101,34,0.15)" : BRAND.cardStrong,
                  borderColor: p.active ? "rgba(242,101,34,0.3)" : BRAND.line,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, color: p.color }}>{p.name}</div>
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 6 }}>{p.desc}</div>
              </Glass>
            ))}
          </div>

          <div className="p-hero-btns" style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="https://inteliflowai.com"
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.deepOrange})`,
                color: BRAND.white,
                fontWeight: 800,
                boxShadow: "0 10px 30px rgba(242,101,34,0.35)",
              }}
            >
              Explore the Full Ecosystem
            </a>

            <a
              href="https://inteliflowai.com/admissions/"
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: `1px solid ${BRAND.line}`,
                color: BRAND.text,
                fontWeight: 700,
              }}
            >
              Visit LIFT
            </a>

            <a
              href="https://app.inteliflowai.com/core/"
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: `1px solid ${BRAND.line}`,
                color: BRAND.text,
                fontWeight: 700,
              }}
            >
              Visit CORE
            </a>
          </div>
        </div>
      </Glass>
    </Section>
  );
}

function ContactForm() {
  return (
    <Section id="contact" style={{ paddingBottom: 16 }}>
      <Glass className="if-card-hover" style={{ padding: 38, position: "relative", overflow: "hidden" }}>
        <Glow left={-20} top={-20} size={180} from={BRAND.orange} to={BRAND.amber} />
        <Glow right={-20} bottom={-20} size={220} from={BRAND.deepOrange} to={BRAND.amber} />

        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Get started</div>
            <h2 style={{ marginTop: 12, fontSize: 42, lineHeight: 1.08, color: BRAND.text }}>Ready to Bring Learning Infrastructure to Your Schools?</h2>
            <p style={{ marginTop: 14, color: BRAND.muted, fontSize: 18, lineHeight: 1.85, maxWidth: 700, marginInline: "auto" }}>
              Tell us about your school and we'll show you how Pulse can work for you.
            </p>
          </div>

          <form
            style={{ marginTop: 28, maxWidth: 520, marginInline: "auto", display: "grid", gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = fd.get("name") || "";
              const school = fd.get("school") || "";
              const email = fd.get("email") || "";
              const role = fd.get("role") || "";
              const message = fd.get("message") || "";
              const subject = encodeURIComponent("Pulse Inquiry: " + (school || "New School"));
              const body = encodeURIComponent("Name: " + name + "\nSchool: " + school + "\nEmail: " + email + "\nRole: " + role + "\n\nMessage:\n" + message);
              window.location.href = "mailto:info@inteliflowai.com?subject=" + subject + "&body=" + body;
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <input name="name" placeholder="Full Name" required style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid " + BRAND.line, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }} />
              <input name="email" type="email" placeholder="Work Email" required style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid " + BRAND.line, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <input name="school" placeholder="School / Organization" required style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid " + BRAND.line, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }} />
              <select name="role" style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid " + BRAND.line, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14 }}>
                <option value="">Your Role</option>
                <option value="School Leader">School Leader</option>
                <option value="IT Director">IT Director</option>
                <option value="Teacher">Teacher</option>
                <option value="District Admin">District Admin</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <textarea name="message" placeholder="Tell us about your school and what you're looking for..." rows={4} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid " + BRAND.line, background: "rgba(255,255,255,0.10)", color: BRAND.text, fontSize: 14, resize: "vertical" }} />
            <button type="submit" style={{ padding: "16px 24px", borderRadius: 999, background: "linear-gradient(135deg, " + BRAND.orange + ", " + BRAND.deepOrange + ")", color: BRAND.white, fontWeight: 800, border: 0, cursor: "pointer", fontSize: 15, boxShadow: "0 10px 30px rgba(242,101,34,0.35)" }}>
              Request a Demo
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: BRAND.muted, margin: 0 }}>No commitment. We'll reach out within 24 hours.</p>
          </form>

          <div className="p-hero-btns" style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href="https://pulse.inteliflowai.com/api-docs"
              style={{
                padding: "14px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: `1px solid ${BRAND.line}`,
                color: BRAND.text,
                fontWeight: 700,
              }}
            >
              API Documentation
            </a>
          </div>
        </div>
      </Glass>
    </Section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 0, background: "rgba(255,255,255,0.08)" }}>
      <div
        className="pulse-container"
        style={{
          padding: "26px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={pulseLogo} alt="Pulse" style={{ height: 50, width: "auto", objectFit: "contain" }} />
          <div style={{ color: BRAND.muted, fontSize: 14 }}>Learning, Delivery Infrastructure</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 14, flexWrap: "wrap" }}>
          <a href="https://inteliflowai.com" style={{ color: BRAND.muted }}>Inteliflow</a>
          <a href="https://pulse.inteliflowai.com/api-docs" style={{ color: BRAND.muted }}>API Docs</a>
          <a href="#contact" style={{ color: BRAND.muted }}>Contact Us</a>
        </div>

        <div style={{ color: BRAND.muted, fontSize: 13 }}>© 2026 Inteliflow AI. All rights reserved.</div>
      </div>
    </footer>
  );
}

export default function App() {
  usePageStyles();

  useEffect(() => {
    document.title = "Pulse — Learning, Delivery Infrastructure | Inteliflow";
  }, []);

  return (
    <div className="pulse-breakout">
      <div
        className="pulse-app"
        style={{
          background: `
            radial-gradient(circle at 10% 10%, rgba(242,101,34,0.18), transparent 22%),
            radial-gradient(circle at 86% 12%, rgba(245,158,11,0.14), transparent 18%),
            radial-gradient(circle at 45% 78%, rgba(242,101,34,0.12), transparent 22%),
            linear-gradient(180deg, ${BRAND.bg} 0%, ${BRAND.bg2} 46%, ${BRAND.bg3} 100%)
          `,
        }}
      >
        <Header />
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Architecture />
        <ClassroomDemo />
        <PlatformSection />
        <ContactForm />
        <Footer />
      </div>
    </div>
  );
}