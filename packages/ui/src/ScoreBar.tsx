import React from "react";

interface ScoreBarProps {
  score: number; // 1-5
  maxScore?: number;
  label?: string;
}

export function ScoreBar({ score, maxScore = 5, label }: ScoreBarProps) {
  const pct = Math.min(100, (score / maxScore) * 100);
  const color = pct >= 80 ? "#51cf66" : pct >= 60 ? "#fcc419" : "#ff6b6b";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {label && (
        <span style={{ fontSize: 12, color: "#8888a0", minWidth: 80 }}>
          {label}
        </span>
      )}
      <div
        style={{
          flex: 1,
          height: 6,
          backgroundColor: "#2a2a3e",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30 }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}
