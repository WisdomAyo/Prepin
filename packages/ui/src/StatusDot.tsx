import React from "react";

interface StatusDotProps {
  status: "connected" | "connecting" | "disconnected" | "error";
  size?: "sm" | "md";
}

const colors: Record<StatusDotProps["status"], string> = {
  connected: "#51cf66",
  connecting: "#fcc419",
  disconnected: "#868e96",
  error: "#ff6b6b",
};

export function StatusDot({ status, size = "sm" }: StatusDotProps) {
  const px = size === "sm" ? 8 : 12;
  return (
    <span
      style={{
        display: "inline-block",
        width: px,
        height: px,
        borderRadius: "50%",
        backgroundColor: colors[status],
        animation: status === "connecting" ? "pulse 1.5s infinite" : undefined,
      }}
    />
  );
}
