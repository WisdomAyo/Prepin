/**
 * Overlay renderer — the always-on-top window that shows the current answer.
 *
 * Three display modes:
 *   - "full"    — standard card with headline + bullets + spoken version
 *   - "compact" — single-line headline only, minimal footprint
 *   - "presentation" — large text optimized for glancing while speaking
 *
 * Modes are cycled via Ctrl+Shift+C global hotkey.
 */

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
  const [opacity, setOpacity] = useState(0.9);
  const [mode, setMode] = useState<DisplayMode>("full");
  const [stealthMode, setStealthMode] = useState(false);

  useEffect(() => {
    const desktop = (window as any).copilotDesktop;
    if (desktop?.onOverlayData) {
      desktop.onOverlayData((data: any) => {
        if (data?.type === "answer") {
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
  }, []);

  if (!answer) {
    return (
      <div style={{
        padding: mode === "compact" ? 6 : 16,
        color: "#666",
        fontSize: mode === "compact" ? 10 : 12,
        textAlign: "center",
        fontFamily: "system-ui",
      }}>
        {mode === "compact" || stealthMode ? "..." : "Listening for questions..."}
      </div>
    );
  }

  if (mode === "compact" || stealthMode) return <CompactView answer={answer} opacity={opacity} />;
  if (mode === "presentation") return <PresentationView answer={answer} opacity={opacity} />;
  return <FullView answer={answer} opacity={opacity} />;
}

// ── Full Mode ─────────────────────────────────────────────────

function FullView({ answer, opacity }: { answer: AnswerData; opacity: number }) {
  return (
    <div style={{ padding: 8, opacity }}>
      <div style={{
        background: "rgba(20, 20, 32, 0.95)",
        border: "1px solid #2a2a3e",
        borderRadius: 8,
        padding: 12,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#e4e4ed",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {answer.headline}
        </div>

        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.5 }}>
          {answer.bullets.filter(Boolean).map((b, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{b}</li>
          ))}
        </ul>

        {answer.spokenVersion && (
          <div style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #2a2a3e",
            fontSize: 12,
            fontStyle: "italic",
            color: "#aaa",
          }}>
            {answer.spokenVersion}
          </div>
        )}

        <div style={{ marginTop: 6, fontSize: 10, color: "#555", display: "flex", gap: 8 }}>
          {answer.latencyMs !== undefined && <span>{answer.latencyMs}ms</span>}
          {answer.hasAssumptions && <span style={{ color: "#fcc419" }}>⚠ assumptions</span>}
          <span style={{ marginLeft: "auto" }}>FULL</span>
        </div>
      </div>
    </div>
  );
}

// ── Compact Mode ──────────────────────────────────────────────

function CompactView({ answer, opacity }: { answer: AnswerData; opacity: number }) {
  return (
    <div style={{ padding: 4, opacity }}>
      <div style={{
        background: "rgba(20, 20, 32, 0.95)",
        border: "1px solid #2a2a3e",
        borderRadius: 6,
        padding: "6px 10px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#e4e4ed",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#4ade80",
          flexShrink: 0,
        }} />
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
        }}>
          {answer.headline}
        </div>
        <div style={{ fontSize: 9, color: "#555", flexShrink: 0 }}>
          {answer.bullets.filter(Boolean).length} pts
        </div>
      </div>
    </div>
  );
}

// ── Presentation Mode ─────────────────────────────────────────

function PresentationView({ answer, opacity }: { answer: AnswerData; opacity: number }) {
  return (
    <div style={{ padding: 12, opacity }}>
      <div style={{
        background: "rgba(10, 10, 20, 0.97)",
        border: "1px solid #3b3b5c",
        borderRadius: 12,
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#f0f0ff",
      }}>
        {/* Large headline for glancing */}
        <div style={{
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.3,
          marginBottom: 14,
          letterSpacing: "-0.01em",
        }}>
          {answer.headline}
        </div>

        {/* Big bullets — easy to read at a distance */}
        <div style={{ fontSize: 16, lineHeight: 1.6 }}>
          {answer.bullets.filter(Boolean).map((b, i) => (
            <div key={i} style={{
              marginBottom: 8,
              paddingLeft: 16,
              borderLeft: "3px solid #6366f1",
            }}>
              {b}
            </div>
          ))}
        </div>

        {/* Spoken version prominent in presentation mode */}
        {answer.spokenVersion && (
          <div style={{
            marginTop: 14,
            padding: 12,
            background: "rgba(99, 102, 241, 0.1)",
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#c4b5fd",
          }}>
            💬 {answer.spokenVersion}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: "#555", textAlign: "right" }}>
          PRESENTATION
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(<OverlayApp />);
}
