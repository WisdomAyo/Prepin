import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

type DisplayMode = "full" | "compact" | "presentation";

interface AnswerData {
  headline: string;
  bullets: string[];
  spokenVersion?: string;
  latencyMs?: number;
  hasAssumptions?: boolean;
}

function OverlayApp() {
  const [answer, setAnswer] = useState<AnswerData | null>(null);
  const [opacity, setOpacity] = useState(0.95);
  const [mode, setMode] = useState<DisplayMode>("full");
  const [history, setHistory] = useState<AnswerData[]>([]);
  const [stealthMode, setStealthMode] = useState(false);

  useEffect(() => {
    const desktop = (window as any).copilotDesktop;
    if (desktop?.onOverlayData) {
      desktop.onOverlayData((data: any) => {
        if (data?.type === "answer") {
          if (answer && !stealthMode) setHistory((h) => [answer, ...h].slice(0, 5));
          setAnswer(data.payload);
        } else if (data?.type === "opacity") {
          setOpacity(data.value);
        } else if (data?.type === "clear") {
          setAnswer(null);
        } else if (data?.type === "mode") {
          setMode(data.value);
        } else if (data?.type === "stealth_mode") {
          setStealthMode(Boolean(data.value));
        } else if (data?.type === "session_settings") {
          setStealthMode(Boolean(data.payload?.stealthMode));
        }
      });
    }
  }, [answer, stealthMode]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Drag handle — always visible */}
      <DragHandle mode={mode} hasAnswer={!!answer} stealthMode={stealthMode} />

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: "auto",
        opacity,
        padding: mode === "compact" ? 0 : 4,
      }}>
        {!answer ? (
          <EmptyState mode={mode} />
        ) : mode === "compact" || stealthMode ? (
          <CompactView answer={answer} />
        ) : mode === "presentation" ? (
          <PresentationView answer={answer} />
        ) : (
          <FullView answer={answer} history={stealthMode ? [] : history} />
        )}
      </div>
    </div>
  );
}

function DragHandle({
  mode,
  hasAnswer,
  stealthMode,
}: {
  mode: DisplayMode;
  hasAnswer: boolean;
  stealthMode: boolean;
}) {
  return (
    <div style={{
      WebkitAppRegion: "drag" as any,
      padding: mode === "compact" ? "3px 8px" : "5px 10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "rgba(10, 10, 18, 0.95)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      cursor: "grab",
      userSelect: "none",
      borderRadius: mode === "compact" ? "8px 8px 0 0" : "12px 12px 0 0",
    } as React.CSSProperties & { WebkitAppRegion: string }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Drag dots */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, opacity: 0.3 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#888" }} />
          ))}
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#818cf8", letterSpacing: "0.05em" }}>
          {stealthMode ? "READY" : "COPILOT"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 9,
          color: "#555",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {stealthMode ? "stealth" : mode}
        </span>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: hasAnswer ? "#34d399" : "#555",
          transition: "background 0.3s",
        }} />
      </div>
    </div>
  );
}

function EmptyState({ mode }: { mode: DisplayMode }) {
  if (mode === "compact") {
    return (
      <div style={{
        padding: "6px 10px",
        background: "rgba(15, 15, 25, 0.95)",
        color: "#555",
        fontSize: 11,
        fontFamily: "system-ui",
        textAlign: "center",
        borderRadius: "0 0 8px 8px",
      }}>
        Waiting for questions...
      </div>
    );
  }
  return (
    <div style={{
      padding: 24,
      background: "rgba(15, 15, 25, 0.95)",
      borderRadius: "0 0 12px 12px",
      textAlign: "center",
      fontFamily: "system-ui",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 10px",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div style={{ fontSize: 12, color: "#666" }}>Listening for questions...</div>
      <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>Answers will appear here in real-time</div>
    </div>
  );
}

function FullView({ answer, history }: { answer: AnswerData; history: AnswerData[] }) {
  return (
    <div style={{
      background: "rgba(12, 12, 22, 0.97)",
      borderRadius: "0 0 12px 12px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#e4e4ed",
      overflow: "auto",
    }}>
      {/* Headline */}
      <div style={{ padding: "12px 14px 6px", fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
        {answer.headline}
      </div>

      {/* Bullets */}
      <div style={{ padding: "0 14px 10px" }}>
        {answer.bullets.filter(Boolean).map((b, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            fontSize: 13, lineHeight: 1.5, marginBottom: 5,
          }}>
            <span style={{
              marginTop: 6, width: 5, height: 5, borderRadius: "50%",
              background: "#818cf8", flexShrink: 0,
            }} />
            <span>{b}</span>
          </div>
        ))}
      </div>

      {/* Spoken version */}
      {answer.spokenVersion && (
        <div style={{
          margin: "0 10px 10px",
          padding: "8px 12px",
          background: "rgba(99, 102, 241, 0.08)",
          borderRadius: 8,
          border: "1px solid rgba(99, 102, 241, 0.12)",
        }}>
          <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, marginBottom: 3, letterSpacing: "0.05em" }}>
            SAY THIS
          </div>
          <div style={{ fontSize: 12, fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5 }}>
            {answer.spokenVersion}
          </div>
        </div>
      )}

      {/* Meta bar */}
      <div style={{
        padding: "6px 14px",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 10, color: "#555",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        {answer.latencyMs !== undefined && <span style={{ fontFamily: "monospace" }}>{answer.latencyMs}ms</span>}
        {answer.hasAssumptions && <span style={{ color: "#fbbf24" }}>assumptions</span>}
        <span style={{ marginLeft: "auto" }}>FULL</span>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
          padding: "6px 10px",
        }}>
          <div style={{ fontSize: 9, color: "#444", marginBottom: 4, letterSpacing: "0.05em" }}>
            PREVIOUS
          </div>
          {history.slice(0, 3).map((h, i) => (
            <div key={i} style={{
              padding: "5px 8px", marginBottom: 3,
              background: "rgba(255,255,255,0.02)", borderRadius: 6,
              fontSize: 11, color: "#888",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {h.headline}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompactView({ answer }: { answer: AnswerData }) {
  return (
    <div style={{
      background: "rgba(12, 12, 22, 0.97)",
      borderRadius: "0 0 8px 8px",
      padding: "6px 10px",
      fontFamily: "system-ui",
      color: "#e4e4ed",
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "#34d399", flexShrink: 0,
      }} />
      <div style={{
        fontSize: 12, fontWeight: 500,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        flex: 1,
      }}>
        {answer.headline}
      </div>
      <div style={{ fontSize: 9, color: "#555", flexShrink: 0 }}>
        {answer.bullets.filter(Boolean).length} pts
      </div>
    </div>
  );
}

function PresentationView({ answer }: { answer: AnswerData }) {
  return (
    <div style={{
      background: "rgba(10, 10, 20, 0.97)",
      borderRadius: "0 0 12px 12px",
      padding: 20,
      fontFamily: "system-ui",
      color: "#f0f0ff",
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 14 }}>
        {answer.headline}
      </div>

      <div style={{ fontSize: 16, lineHeight: 1.6 }}>
        {answer.bullets.filter(Boolean).map((b, i) => (
          <div key={i} style={{
            marginBottom: 8, paddingLeft: 16,
            borderLeft: "3px solid #6366f1",
          }}>
            {b}
          </div>
        ))}
      </div>

      {answer.spokenVersion && (
        <div style={{
          marginTop: 14, padding: 12,
          background: "rgba(99, 102, 241, 0.1)",
          borderRadius: 8,
          fontSize: 14, lineHeight: 1.5, color: "#c4b5fd",
        }}>
          {answer.spokenVersion}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: "#555", textAlign: "right" }}>
        PRESENTATION
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(<OverlayApp />);
}
