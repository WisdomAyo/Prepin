/**
 * Compact answer card for the overlay — minimal chrome, maximum readability.
 * Used in the Electron always-on-top overlay where space is at a premium.
 */

import React from "react";

interface CompactAnswerCardProps {
  headline: string;
  bullets: string[];
  spokenVersion?: string;
  latencyMs?: number;
  hasAssumptions?: boolean;
}

export function CompactAnswerCard({
  headline,
  bullets,
  spokenVersion,
  latencyMs,
  hasAssumptions,
}: CompactAnswerCardProps) {
  return (
    <div
      style={{
        background: "rgba(20, 20, 32, 0.95)",
        border: "1px solid #2a2a3e",
        borderRadius: 8,
        padding: 12,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#e4e4ed",
      }}
    >
      {/* Headline */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 8,
          lineHeight: 1.3,
        }}
      >
        {headline}
      </div>

      {/* Bullets */}
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.5 }}>
        {bullets
          .filter(Boolean)
          .map((b, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {b}
            </li>
          ))}
      </ul>

      {/* Spoken version */}
      {spokenVersion && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #2a2a3e",
            fontSize: 12,
            fontStyle: "italic",
            color: "#aaa",
          }}
        >
          {spokenVersion}
        </div>
      )}

      {/* Footer meta */}
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          color: "#666",
          display: "flex",
          gap: 8,
        }}
      >
        {latencyMs !== undefined && <span>{latencyMs}ms</span>}
        {hasAssumptions && (
          <span style={{ color: "#fcc419" }}>has assumptions</span>
        )}
      </div>
    </div>
  );
}
