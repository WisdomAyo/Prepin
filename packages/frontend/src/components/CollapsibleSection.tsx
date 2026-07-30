import { useState } from "react";

interface Props {
  number: number;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ number, title, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-surface)] backdrop-blur-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-brand-600/15 text-brand-300 text-sm font-semibold flex items-center justify-center shrink-0">
          {number}
        </span>
        <span className="text-[15px] font-semibold flex-1 text-left">{title}</span>
        {badge && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-[var(--color-text-muted)] border border-[var(--color-border)]">
            {badge}
          </span>
        )}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
