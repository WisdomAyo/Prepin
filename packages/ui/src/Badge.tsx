import React from "react";

interface BadgeProps {
  variant: "info" | "warning" | "success" | "danger";
  children: React.ReactNode;
}

const styles: Record<BadgeProps["variant"], React.CSSProperties> = {
  info: { backgroundColor: "rgba(92, 124, 250, 0.2)", color: "#91a7ff" },
  warning: { backgroundColor: "rgba(252, 196, 25, 0.2)", color: "#fcc419" },
  success: { backgroundColor: "rgba(81, 207, 102, 0.2)", color: "#51cf66" },
  danger: { backgroundColor: "rgba(255, 107, 107, 0.2)", color: "#ff6b6b" },
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      style={{
        ...styles[variant],
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
