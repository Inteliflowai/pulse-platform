import React, { useState, useEffect, useRef } from "react";

const B = {
  bg: "#120800", text: "#fff4eb", muted: "#d4a574",
  orange: "#f26522", deepOrange: "#e84c1e", amber: "#f59e0b",
  emerald: "#10b981", red: "#ef4444", blue: "#3b82f6",
  line: "rgba(242,101,34,0.25)", card: "rgba(18,8,0,0.92)",
};

const glass = {
  background: B.card,
  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${B.line}`,
  borderRadius: 16,
  fontFamily: "'DM Sans',system-ui,sans-serif",
  color: B.text,
};

const btnPrimary = {
  padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
  background: `linear-gradient(135deg, ${B.orange}, ${B.deepOrange})`,
  color: "#fff", fontSize: 14, fontWeight: 700,
  fontFamily: "'DM Sans',system-ui,sans-serif",
  boxShadow: "0 4px 16px rgba(242,101,34,0.3)",
  width: "100%",
};

const btnOutline = {
  padding: "12px 24px", borderRadius: 10, cursor: "pointer",
  background: "transparent", border: `1px solid rgba(255,255,255,0.14)`,
  color: B.text, fontSize: 14, fontWeight: 600,
  fontFamily: "'DM Sans',system-ui,sans-serif",
  width: "100%",
};

/* ─── Step 1: Video Player ─── */
function VideoStep({ onNext }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const interval = useRef(null);

  function handlePlay() {
    setPlaying(true);
    interval.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval.current);
          setDone(true);
          setPlaying(false);
          return 100;
        }
        return p + 2;
      });
    }, 100);
  }

  useEffect(() => () => { if (interval.current) clearInterval(interval.current); }, []);

  return (
    <div>
      {/* Video area */}
      <div
        onClick={!playing && !done ? handlePlay : undefined}
        style={{
          background: "#0a0500", borderRadius: 10, aspectRatio: "16/9",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden", cursor: !playing && !done ? "pointer" : "default",
          marginBottom: 14,
        }}
      >
        {!playing && !done && (
          <div style={{ width: 56, height: 56, borderRadius: 999, background: "rgba(242,101,34,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22, marginLeft: 4, color: "#fff" }}>&#9654;</span>
          </div>
        )}
        {playing && (
          <div style={{ fontSize: 13, color: B.muted }}>Playing...</div>
        )}
        {done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, color: B.emerald, marginBottom: 6 }}>&#10003;</div>
            <div style={{ fontSize: 13, color: B.text }}>Video complete</div>
          </div>
        )}
        {/* Progress bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.1)" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: B.orange, borderRadius: 2, transition: "width 100ms linear" }} />
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Introduction to Chemical Reactions</div>
      <div style={{ fontSize: 12, color: B.muted, marginBottom: 16 }}>Chemistry · Grade 10</div>

      {done && (
        <button onClick={onNext} style={btnPrimary}>Next in sequence &#8594;</button>
      )}
      {!done && !playing && (
        <div style={{ fontSize: 12, color: B.muted, textAlign: "center" }}>Click the play button to start</div>
      )}
    </div>
  );
}

/* ─── Step 2: CORE Quiz ─── */
const QUESTIONS = [
  {
    q: "What is a catalyst?",
    opts: [
      "A substance that slows reactions",
      "A substance that speeds up reactions without being consumed",
      "A type of chemical bond",
      "A product of combustion",
    ],
    correct: 1,
  },
  {
    q: "What type of reaction absorbs energy?",
    opts: ["Exothermic", "Endothermic", "Synthesis", "Decomposition"],
    correct: 1,
  },
  {
    q: "Balance this equation: H\u2082 + O\u2082 \u2192 H\u2082O",
    opts: [
      "H\u2082 + O\u2082 \u2192 H\u2082O",
      "2H\u2082 + O\u2082 \u2192 2H\u2082O",
      "H\u2082 + 2O\u2082 \u2192 2H\u2082O",
      "3H\u2082 + O\u2082 \u2192 3H\u2082O",
    ],
    correct: 1,
  },
];

function QuizStep({ onNext, onScore }) {
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const LETTERS = "ABCD";

  function handleSelect(idx) {
    if (selected !== null) return;
    setSelected(idx);
  }

  function handleNext() {
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected(null);
    if (qi + 1 >= QUESTIONS.length) {
      const score = newAnswers.filter((a, i) => a === QUESTIONS[i].correct).length;
      onScore(score);
      setShowResult(true);
    } else {
      setQi(qi + 1);
    }
  }

  if (showResult) {
    const score = answers.filter((a, i) => a === QUESTIONS[i].correct).length;
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: score >= 2 ? B.emerald : B.amber, marginBottom: 8 }}>
          {score}/{QUESTIONS.length}
        </div>
        <div style={{ fontSize: 14, color: B.text, marginBottom: 4 }}>Quiz complete</div>
        <div style={{ fontSize: 12, color: B.muted, marginBottom: 20 }}>
          {score >= 2 ? "Good work!" : "Review the material and try again."}
        </div>
        <button onClick={onNext} style={btnPrimary}>Continue &#8594;</button>
      </div>
    );
  }

  const question = QUESTIONS[qi];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: B.muted }}>CORE Quiz · Question {qi + 1} of {QUESTIONS.length}</div>
        <div style={{ fontSize: 11, color: B.orange, fontWeight: 600 }}>Chemistry</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>{question.q}</div>
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {question.opts.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = selected !== null && i === question.correct;
          const isWrong = isSelected && i !== question.correct;
          let bg = "rgba(255,255,255,0.04)";
          let border = "1px solid rgba(255,255,255,0.08)";
          let letterBg = "rgba(255,255,255,0.1)";
          let letterColor = B.muted;
          if (isSelected && isCorrect) { bg = "rgba(16,185,129,0.15)"; border = `1px solid ${B.emerald}`; letterBg = B.emerald; letterColor = "#fff"; }
          if (isWrong) { bg = "rgba(239,68,68,0.12)"; border = `1px solid ${B.red}`; letterBg = B.red; letterColor = "#fff"; }
          if (!isSelected && selected !== null && isCorrect) { bg = "rgba(16,185,129,0.08)"; border = `1px solid ${B.emerald}44`; }
          return (
            <div
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10,
                background: bg, border, cursor: selected === null ? "pointer" : "default",
                transition: "all .2s", fontSize: 13,
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 999, background: letterBg, color: letterColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {LETTERS[i]}
              </div>
              <span style={{ color: B.text }}>{opt}</span>
            </div>
          );
        })}
      </div>
      {selected !== null && (
        <button onClick={handleNext} style={btnPrimary}>
          {qi + 1 >= QUESTIONS.length ? "See Results" : "Next Question"} &#8594;
        </button>
      )}
    </div>
  );
}

/* ─── Step 3: Spark Experience ─── */
function SparkStep({ onNext, onSparkResult }) {
  const [answered, setAnswered] = useState(null);

  function handleAnswer(choice) {
    setAnswered(choice);
    onSparkResult(choice === "faster");
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: B.amber, fontWeight: 600, marginBottom: 14 }}>Spark · Prediction</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, lineHeight: 1.5 }}>
        If you increase the temperature of a reaction, will it proceed faster or slower?
      </div>

      {answered === null ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {["faster", "slower"].map((choice) => (
            <button
              key={choice}
              onClick={() => handleAnswer(choice)}
              style={{
                padding: "16px 0", borderRadius: 10, cursor: "pointer",
                background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`,
                color: B.text, fontSize: 15, fontWeight: 700, textTransform: "capitalize",
                fontFamily: "'DM Sans',system-ui,sans-serif",
              }}
            >
              {choice === "faster" ? "&#8593;" : "&#8595;"} {choice.charAt(0).toUpperCase() + choice.slice(1)}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 36, color: answered === "faster" ? B.emerald : B.red, marginBottom: 8 }}>
            {answered === "faster" ? "&#10003;" : "&#10007;"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: B.text, marginBottom: 6 }}>
            {answered === "faster" ? "Correct!" : "Not quite."}
          </div>
          <div style={{ fontSize: 13, color: B.muted, marginBottom: 20, lineHeight: 1.6 }}>
            Higher temperature = more kinetic energy = faster molecular collisions = faster reaction rate.
          </div>
          <button onClick={onNext} style={btnPrimary}>Continue &#8594;</button>
        </div>
      )}
    </div>
  );
}

/* ─── Step 4: Results Summary ─── */
function ResultsStep({ quizScore, sparkCorrect }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>&#127891;</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: B.text }}>Today's Session Complete</div>
      <div style={{ fontSize: 12, color: B.muted, marginBottom: 20 }}>Chemistry · Grade 10</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: quizScore >= 2 ? B.emerald : B.amber }}>{quizScore}/3</div>
          <div style={{ fontSize: 10, color: B.muted, marginTop: 4 }}>Quiz Score</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: sparkCorrect ? B.emerald : B.red }}>{sparkCorrect ? "&#10003;" : "&#10007;"}</div>
          <div style={{ fontSize: 10, color: B.muted, marginTop: 4 }}>Spark</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: B.text }}>8m</div>
          <div style={{ fontSize: 10, color: B.muted, marginTop: 4 }}>Total Time</div>
        </div>
      </div>

      <div style={{ background: "rgba(242,101,34,0.08)", border: `1px solid ${B.line}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: B.text, lineHeight: 1.6 }}>
        Good effort! Review catalysts before next class. All results sent to your teacher via CORE.
      </div>

      <a href="#contact" style={{ ...btnPrimary, display: "block", textDecoration: "none", textAlign: "center" }}>
        See how Pulse works for your school &#8594;
      </a>
    </div>
  );
}

/* ─── Main Simulator ─── */
export default function PulseClassroomSimulator() {
  const [step, setStep] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [sparkCorrect, setSparkCorrect] = useState(false);

  const steps = ["Video", "Quiz", "Spark", "Results"];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Device frame */}
      <div style={{
        ...glass,
        borderRadius: 20,
        boxShadow: "0 32px 80px rgba(18,8,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: B.orange }}>Pulse</span>
            <span style={{ color: B.muted }}>Room 204</span>
            <span style={{ color: B.muted }}>·</span>
            <span style={{ color: B.text }}>Jordan Kim</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: B.emerald }} />
            <span style={{ fontSize: 10, color: B.emerald }}>Online</span>
          </div>
        </div>

        {/* Step progress */}
        <div style={{ display: "flex", gap: 3, padding: "8px 16px" }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? B.orange : "rgba(255,255,255,0.08)", transition: "background .3s", marginBottom: 4 }} />
              <div style={{ fontSize: 9, color: i === step ? B.orange : B.muted, fontWeight: i === step ? 700 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "12px 20px 24px" }}>
          {step === 0 && (
            <>
              <div style={{ fontSize: 11, color: B.muted, marginBottom: 12 }}>
                &#9650; Loading from local Pulse node...
              </div>
              <VideoStep onNext={() => setStep(1)} />
            </>
          )}
          {step === 1 && (
            <>
              <div style={{ background: "rgba(242,101,34,0.08)", border: `1px solid ${B.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: B.orange, marginBottom: 14 }}>
                CORE is preparing your quiz...
              </div>
              <QuizStep onNext={() => setStep(2)} onScore={setQuizScore} />
            </>
          )}
          {step === 2 && (
            <>
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: B.amber, marginBottom: 14 }}>
                Loading Spark experience...
              </div>
              <SparkStep onNext={() => setStep(3)} onSparkResult={setSparkCorrect} />
            </>
          )}
          {step === 3 && <ResultsStep quizScore={quizScore} sparkCorrect={sparkCorrect} />}
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{ textAlign: "center", fontSize: 11, color: B.muted, marginTop: 16, lineHeight: 1.6, maxWidth: 400, marginInline: "auto" }}>
        This is a simulation. In a real classroom, content streams from a local Pulse node — no internet required during the lesson.
      </p>
    </div>
  );
}
