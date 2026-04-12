import React, { useEffect, useState } from "react";

const ASSET_BASE = "/wp-content/reactpress/apps/pulse-marketing";
const IMG = (file) => `${ASSET_BASE}/images/${encodeURIComponent(file)}`;

const BRAND = {
  bg: "#2b1460",
  bg2: "#4a2286",
  bg3: "#6a2ea2",
  white: "#ffffff",
  text: "#f7f1ff",
  muted: "#ddd0f7",
  line: "rgba(255,255,255,0.16)",
  card: "rgba(255,255,255,0.10)",
  cardStrong: "rgba(255,255,255,0.16)",
  blue: "#8b5cf6",
  sky: "#c084fc",
  purple: "#7c3aed",
  magenta: "#ec4899",
  green: "#facc15",
  mint: "#fde047",
  orange: "#f59e0b",
  shadow: "0 24px 80px rgba(18, 8, 43, 0.35)",
};

const PULSE_GLOW = { from: "#fb7185", to: "#f59e0b" };

const pulseLogo = `${IMG("pulse-logo.png")}?v=1`;
const inteliflowLogo = "/wp-content/reactpress/apps/inteliflow-site/images/inteliFlow-logo-dark-background.png";

function usePageStyles() {
  useEffect(() => {
    const id = "pulse-marketing-scoped-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      html { scroll-behavior: smooth; }
      body { margin: 0; padding: 0; }
      .wp-site-blocks { padding: 0 !important; max-width: 100% !important; }
      .wp-site-blocks > * { max-width: 100% !important; padding: 0 !important; }
      .entry-content, .page-content, .post-content { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
      .wp-block-post-content { max-width: 100% !important; padding: 0 !important; }
      .is-layout-constrained > * { max-width: 100% !important; }
      .wp-block-post-title, h1.entry-title, h1.wp-block-post-title, .page-title { display: none !important; }

      .pulse-app { position: relative; min-height: 100vh; width: 100%; max-width: 100%; overflow-x: hidden; color: ${BRAND.text}; }
      .pulse-app, .pulse-app * { box-sizing: border-box; }
      .pulse-app a { text-decoration: none; }
      .pulse-app img { max-width: 100%; height: auto; }

      .pulse-app .if-card-hover { transition: transform .35s ease, box-shadow .35s ease, border-color .35s ease; }
      .pulse-app .if-card-hover:hover { transform: translateY(-5px); box-shadow: 0 26px 70px rgba(18,8,43,.32); border-color: rgba(255,255,255,.22); }

      @keyframes pulse-float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
      @keyframes pulse-glow { 0% { opacity: .10; transform: scale(1); } 50% { opacity: .20; transform: scale(1.05); } 100% { opacity: .10; transform: scale(1); } }
      .pulse-app .p-float { animation: pulse-float 9s ease-in-out infinite; }
      .pulse-app .p-glow { animation: pulse-glow 8s ease-in-out infinite; }

      @media (max-width: 1024px) {
        .pulse-app .p-grid-hero, .pulse-app .p-grid-two { grid-template-columns: 1fr !important; }
        .pulse-app .p-grid-three, .pulse-app .p-grid-four { grid-template-columns: 1fr 1fr !important; }
      }
      @media (max-width: 720px) {
        .pulse-app .p-grid-three, .pulse-app .p-grid-four { grid-template-columns: 1fr !important; }
        .pulse-app .p-title { font-size: 42px !important; line-height: 1.04 !important; }
        .pulse-app .p-section { padding: 56px 16px !important; }
        .pulse-app .p-hero-btns { flex-direction: column !important; align-items: stretch !important; }
        .pulse-app .p-hero-btns a { width: 100% !important; text-align: center !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

function Section({ id, children, style = {} }) {
  return (
    <section id={id} className="p-section" style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 20px", position: "relative", ...style }}>
      {children}
    </section>
  );
}

function Glass({ children, style = {}, className = "" }) {
  return (
    <div className={className} style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 28, boxShadow: BRAND.shadow, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", ...style }}>
      {children}
    </div>
  );
}

function Glow({ left, right, top, bottom, size = 240, from = BRAND.blue, to = BRAND.magenta, opacity = 0.18 }) {
  return <div className="p-glow" style={{ position: "absolute", left, right, top, bottom, width: size, height: size, borderRadius: 999, background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`, filter: "blur(60px)", opacity, pointerEvents: "none" }} />;
}

function Header() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(43,20,96,0.74)", borderBottom: `1px solid ${BRAND.line}`, backdropFilter: "blur(16px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={pulseLogo} alt="Pulse" style={{ height: 40, width: "auto", objectFit: "contain" }} />
        </a>
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="#features" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Features</a>
          <a href="#how-it-works" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>How It Works</a>
          <a href="#architecture" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Architecture</a>
          <a href="#platform" style={{ color: BRAND.muted, fontWeight: 600, fontSize: 14 }}>Platform</a>
          <a href="https://pulse.inteliflowai.com/login" style={{ padding: "14px 18px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.orange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 10px 30px rgba(236,72,153,0.35)" }}>
            Sign In
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <Section id="top" style={{ paddingTop: 110, paddingBottom: 72, overflow: "hidden" }}>
      <Glow left={-60} top={10} size={300} from={PULSE_GLOW.from} to={PULSE_GLOW.to} />
      <Glow right={-50} top={40} size={260} from={BRAND.purple} to={BRAND.orange} />

      <div className="p-grid-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 36, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981", animation: "pulse-glow 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, color: BRAND.muted }}>Part of the Inteliflow Learning Platform</span>
          </div>

          <h1 className="p-title" style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: -2.8, color: BRAND.text }}>
            Education<br />
            <span style={{ background: `linear-gradient(135deg, ${PULSE_GLOW.from}, ${PULSE_GLOW.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              that works offline
            </span>
          </h1>

          <p style={{ marginTop: 18, fontSize: 22, lineHeight: 1.6, color: BRAND.text, maxWidth: 680 }}>
            Pulse delivers video lessons, quizzes, and interactive content to school nodes that survive internet outages.
          </p>
          <p style={{ marginTop: 12, fontSize: 17, lineHeight: 1.8, color: BRAND.muted, maxWidth: 620 }}>
            Students keep learning. Teachers keep teaching. Connectivity optional.
          </p>

          <div className="p-hero-btns" style={{ marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="https://pulse.inteliflowai.com/login" style={{ padding: "16px 22px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.orange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 12px 30px rgba(236,72,153,0.35)" }}>
              Get Started
            </a>
            <a href="#how-it-works" style={{ padding: "16px 22px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.cardStrong, color: BRAND.text, fontWeight: 700 }}>
              See How It Works
            </a>
          </div>
        </div>

        <Glass className="if-card-hover" style={{ overflow: "hidden", padding: 28, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ display: "grid", gap: 16 }}>
            {/* Dashboard preview mockup */}
            <div style={{ background: "rgba(15,17,23,0.9)", borderRadius: 16, padding: 20, border: `1px solid ${BRAND.line}` }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} />
                <div style={{ width: 10, height: 10, borderRadius: 999, background: "#10b981" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Nodes Online", value: "12", color: "#10b981" },
                  { label: "Active Sessions", value: "347", color: "#6366f1" },
                  { label: "Content Synced", value: "98%", color: "#f59e0b" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                {["Maputo School #4 — syncing 3 packages...", "Lagos Academy — 45 students active", "Lima Campus — quiz results ready"].map((line) => (
                  <div key={line} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: BRAND.muted, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: "#10b981", flexShrink: 0 }} />
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Glass>
      </div>
    </Section>
  );
}

function StatsBar() {
  return (
    <div style={{ borderTop: `1px solid ${BRAND.line}`, borderBottom: `1px solid ${BRAND.line}`, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 20px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, textAlign: "center" }}>
        {[
          { value: "40+", label: "Dashboard Pages" },
          { value: "100%", label: "Offline Capable" },
          { value: "3", label: "Languages" },
          { value: "< 30s", label: "Sync Detection" },
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
    { icon: "\u26A1", title: "Offline-First Delivery", desc: "Content syncs to on-prem nodes and plays locally. No internet? No problem. Students never see a loading spinner.", color: `${BRAND.mint}` },
    { icon: "\uD83C\uDFAC", title: "Jellyfin Media Engine", desc: "Built on Jellyfin for rock-solid video streaming. Supports all formats, transcoding, and multi-device playback.", color: BRAND.sky },
    { icon: "\uD83D\uDCDA", title: "Sequenced Learning", desc: "Build learning flows: video \u2192 quiz \u2192 video \u2192 activity. Auto-advance when videos end. Timed quizzes with instant scoring.", color: "#60a5fa" },
    { icon: "\uD83C\uDF93", title: "Teacher Conductor", desc: "Teachers control the classroom in real-time. Step through content, and every student device follows along automatically.", color: "#34d399" },
    { icon: "\uD83D\uDCCA", title: "Analytics & Monitoring", desc: "Fleet-wide dashboards, quiz results, student progress, session tracking. Know exactly what's happening at every school.", color: BRAND.blue },
    { icon: "\uD83D\uDD12", title: "Multi-Tenant & Secure", desc: "Row-level security, role-based access, enrollment tokens, device management. Each school sees only their own data.", color: BRAND.magenta },
    { icon: "\uD83C\uDF10", title: "Multi-Language", desc: "Classroom player supports English, Portuguese, and Spanish. More languages easily added for any region.", color: BRAND.orange },
    { icon: "\uD83D\uDD04", title: "Auto-Sync & Updates", desc: "Content syncs automatically. Node software updates with rollback. Bandwidth throttling to protect school internet.", color: "#a78bfa" },
  ];

  return (
    <Section id="features">
      <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Features</div>
      <h2 style={{ marginTop: 12, fontSize: 48, lineHeight: 1.06, color: BRAND.text }}>Everything Schools Need to Deliver Content</h2>
      <p style={{ marginTop: 14, maxWidth: 860, color: BRAND.muted, fontSize: 18, lineHeight: 1.8 }}>
        From cloud management to classroom playback \u2014 one platform, fully integrated.
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
    { step: "01", title: "Upload & Package", desc: "Upload video lessons and documents to the cloud. Bundle them into packages with quizzes. Assign to grades and subjects.", color: BRAND.magenta },
    { step: "02", title: "Sync to Nodes", desc: "Push packages to school nodes. The sync worker downloads, verifies checksums, and registers with Jellyfin \u2014 automatically.", color: BRAND.orange },
    { step: "03", title: "Learn Anywhere", desc: "Students enroll devices, log in, and learn. Videos stream locally from Jellyfin. Quizzes auto-trigger after videos. Works fully offline.", color: "#10b981" },
  ];

  return (
    <Section id="how-it-works" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>How it works</div>
      <h2 style={{ marginTop: 12, fontSize: 44, lineHeight: 1.08, color: BRAND.text }}>Three Steps from Content to Classroom</h2>

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
        A split architecture that keeps schools running even when the internet doesn't.
      </p>

      <div className="p-grid-two" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Glass className="if-card-hover" style={{ padding: 28, background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}>
          <div style={{ color: "#818cf8", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Cloud (Vercel + Supabase)</div>
          <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
            {[
              "40+ page dashboard for full school management",
              "Content upload, packaging, and curriculum builder",
              "Quiz engine with scoring and progress tracking",
              "Fleet monitoring, analytics, and audit logs",
              "33 REST API endpoints with rate limiting & RLS",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "#818cf8", marginTop: 6, flexShrink: 0 }} />
                <div style={{ color: BRAND.text, lineHeight: 1.7, fontSize: 14 }}>{line}</div>
              </div>
            ))}
          </div>
        </Glass>

        <Glass className="if-card-hover" style={{ padding: 28, background: "rgba(251,113,133,0.08)", borderColor: "rgba(251,113,133,0.2)" }}>
          <div style={{ color: "#fb7185", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>School Node (On-Prem)</div>
          <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
            {[
              "Jellyfin media server for local video streaming",
              "Sync worker downloads & verifies content automatically",
              "Classroom player \u2014 works 100% offline after first sync",
              "Device enrollment with QR codes",
              "Auto-backup, health monitoring, OTA updates",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "#fb7185", marginTop: 6, flexShrink: 0 }} />
                <div style={{ color: BRAND.text, lineHeight: 1.7, fontSize: 14 }}>{line}</div>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    </Section>
  );
}

function PlatformSection() {
  return (
    <Section id="platform" style={{ overflow: "hidden" }}>
      <Glow left={-40} top={-10} size={220} from={PULSE_GLOW.from} to={PULSE_GLOW.to} opacity={0.16} />
      <Glass className="if-card-hover" style={{ padding: 34, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Part of the Inteliflow Platform</div>
          <h2 style={{ marginTop: 12, fontSize: 42, lineHeight: 1.08, color: BRAND.text }}>Pulse Works Better With the Full Platform</h2>
          <p style={{ marginTop: 14, maxWidth: 900, color: BRAND.muted, fontSize: 18, lineHeight: 1.85 }}>
            Pulse handles delivery. But when combined with LIFT (admissions insight), CORE (classroom learning), and SPARK (hands-on discovery), you get a complete connected learning ecosystem.
          </p>

          <div className="p-grid-four" style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            {[
              { name: "LIFT", desc: "Admissions & Placement", color: "#6ee7b7" },
              { name: "CORE", desc: "Classroom Learning", color: "#a78bfa" },
              { name: "SPARK", desc: "Hands-On Discovery", color: BRAND.orange },
              { name: "PULSE", desc: "Content Delivery", color: PULSE_GLOW.from, active: true },
            ].map((p) => (
              <Glass key={p.name} style={{ padding: 20, textAlign: "center", background: p.active ? "rgba(251,113,133,0.15)" : BRAND.cardStrong, borderColor: p.active ? "rgba(251,113,133,0.3)" : BRAND.line }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: p.color }}>{p.name}</div>
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 6 }}>{p.desc}</div>
              </Glass>
            ))}
          </div>

          <div className="p-hero-btns" style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="https://inteliflowai.com" style={{ padding: "16px 22px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.orange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 10px 30px rgba(236,72,153,0.35)" }}>
              Explore the Full Platform
            </a>
            <a href="https://inteliflowai.com/admissions/" style={{ padding: "16px 22px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 700 }}>
              Visit LIFT Admissions
            </a>
          </div>
        </div>
      </Glass>
    </Section>
  );
}

function CTASection() {
  return (
    <Section id="cta">
      <Glass className="if-card-hover" style={{ padding: 38, position: "relative", overflow: "hidden", textAlign: "center" }}>
        <Glow left={-20} top={-20} size={180} from={BRAND.magenta} to={BRAND.sky} />
        <Glow right={-20} bottom={-20} size={220} from={BRAND.orange} to={BRAND.purple} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ color: BRAND.mint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Get started</div>
          <h2 style={{ marginTop: 12, fontSize: 42, lineHeight: 1.08, color: BRAND.text }}>Ready to Bring Learning Infrastructure to Your Schools?</h2>
          <p style={{ marginTop: 14, color: BRAND.muted, fontSize: 18, lineHeight: 1.85, maxWidth: 700, marginInline: "auto" }}>
            Set up your first school node in under 10 minutes. No disruption to existing workflows.
          </p>

          <div className="p-hero-btns" style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <a href="https://pulse.inteliflowai.com/login" style={{ padding: "18px 26px", borderRadius: 999, background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.orange})`, color: BRAND.white, fontWeight: 800, boxShadow: "0 10px 30px rgba(236,72,153,0.35)" }}>
              Sign In to Pulse
            </a>
            <a href="mailto:info@inteliflowai.com?subject=Pulse%20Inquiry" style={{ padding: "18px 26px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 700 }}>
              Contact Sales
            </a>
            <a href="https://pulse.inteliflowai.com/api-docs" style={{ padding: "18px 26px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 700 }}>
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
    <footer style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 40, background: "rgba(255,255,255,0.08)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={pulseLogo} alt="Pulse" style={{ height: 36, width: "auto", objectFit: "contain" }} />
          <div style={{ color: BRAND.muted, fontSize: 14 }}>Learning, Delivery Infrastructure</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 14 }}>
          <a href="https://inteliflowai.com" style={{ color: BRAND.muted }}>Inteliflow</a>
          <a href="https://pulse.inteliflowai.com/api-docs" style={{ color: BRAND.muted }}>API Docs</a>
          <a href="https://pulse.inteliflowai.com/login" style={{ color: BRAND.muted }}>Dashboard</a>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 13 }}>&copy; 2026 Inteliflow AI. All rights reserved.</div>
      </div>
    </footer>
  );
}

export default function App() {
  usePageStyles();

  useEffect(() => {
    document.title = "Pulse \u2014 Learning, Delivery Infrastructure | Inteliflow";
  }, []);

  return (
    <div className="pulse-app" style={{
      background: `
        radial-gradient(circle at 10% 10%, rgba(251,113,133,0.18), transparent 22%),
        radial-gradient(circle at 86% 12%, rgba(245,158,11,0.16), transparent 18%),
        radial-gradient(circle at 45% 78%, rgba(236,72,153,0.14), transparent 22%),
        linear-gradient(180deg, ${BRAND.bg} 0%, ${BRAND.bg2} 46%, ${BRAND.bg3} 100%)
      `,
    }}>
      <Header />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <Architecture />
      <PlatformSection />
      <CTASection />
      <Footer />
    </div>
  );
}
