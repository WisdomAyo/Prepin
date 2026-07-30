import { useSetupStore, LANGUAGE_LABELS, type Language, type ResponseStyle } from "@/stores/setup-store";

export function HeaderToolbar() {
  const { language, setLanguage, responseStyle, setResponseStyle, autoSkip, setAutoSkip } =
    useSetupStore();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Language */}
      <ToolbarDropdown
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
          </svg>
        }
        value={LANGUAGE_LABELS[language]}
        options={Object.entries(LANGUAGE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        onChange={(v) => setLanguage(v as Language)}
      />

      {/* Response Style */}
      <ToolbarDropdown
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        }
        value={responseStyle.charAt(0).toUpperCase() + responseStyle.slice(1)}
        options={[
          { value: "concise", label: "Concise" },
          { value: "balanced", label: "Balanced" },
          { value: "detailed", label: "Detailed" },
        ]}
        onChange={(v) => setResponseStyle(v as ResponseStyle)}
      />

      {/* Model */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span>Gemini Flash</span>
      </div>

      {/* Auto-skip */}
      <button
        onClick={() => setAutoSkip(!autoSkip)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
          autoSkip
            ? "bg-brand-600/10 border-brand-500/30 text-brand-300"
            : "bg-white/5 border-[var(--color-border)] text-[var(--color-text-muted)]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
        Auto-skip {autoSkip ? "On" : "Off"}
      </button>
    </div>
  );
}

function ToolbarDropdown({
  icon,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] cursor-pointer hover:bg-white/[0.07] transition-colors">
      {icon}
      <span>{value}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <select
        value={options.find((o) => o.label === value)?.value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
