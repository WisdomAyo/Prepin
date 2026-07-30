import { useNavigate } from "react-router-dom";
import { useCreateSession } from "@/hooks/useApi";
import { useSetupStore } from "@/stores/setup-store";
import { useState } from "react";
import { HeaderToolbar } from "@/components/HeaderToolbar";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { InterviewSetup } from "@/components/InterviewSetup";
import { DocumentsSection } from "@/components/DocumentsSection";
import { AdvancedSettings } from "@/components/AdvancedSettings";

type SessionMode = "live" | "mock" | "coding";

export function Dashboard() {
  const navigate = useNavigate();
  const createSession = useCreateSession();
  const { selectedResume, selectedJd, stealthMode, setStealthMode } =
    useSetupStore();
  const [activeTab, setActiveTab] = useState<SessionMode>("live");
  const [launching, setLaunching] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  async function startSession() {
    setLaunching(true);
    try {
      const mode = activeTab === "mock" ? "prep" : "live";
      const session = await createSession.mutateAsync({
        mode,
        resume_id: selectedResume || undefined,
        jd_id: selectedJd || undefined,
        stealth_mode: mode === "live" ? stealthMode : false,
      });
      navigate(
        mode === "live"
          ? `/session/${session.id}`
          : `/prep?sessionId=${session.id}`,
      );
    } catch {
      setLaunching(false);
    }
  }

  return (
    <div className="p-6 pb-16 max-w-3xl mx-auto space-y-6">
      {/* Top tabs: Live / Mock / Coding */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 w-fit">
        {(
          [
            { key: "live", label: "Live Interview", badge: null },
            { key: "mock", label: "Mock Interview", badge: null },
            { key: "coding", label: "Coding Assessment", badge: "BETA" },
          ] as const
        ).map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === key
                ? "bg-brand-600/15 text-brand-300 shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
            }`}
          >
            {label}
            {badge && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold leading-none">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Header toolbar row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <HeaderToolbar />
      </div>

      {/* Preset search */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={presetSearch}
          onChange={(e) => setPresetSearch(e.target.value)}
          placeholder="Search saved presets..."
          className="w-full input-field pl-11 py-3 text-sm rounded-2xl"
        />
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-3">
        <CollapsibleSection number={1} title="Interview Setup" defaultOpen>
          <InterviewSetup />
        </CollapsibleSection>

        <CollapsibleSection number={2} title="Documents" badge="drag & drop">
          <DocumentsSection />
        </CollapsibleSection>

        <CollapsibleSection number={3} title="Advanced">
          <AdvancedSettings />
        </CollapsibleSection>
      </div>

      {/* Stealth mode toggle */}
      {activeTab === "live" && (
        <label className="flex items-start gap-3 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer hover:bg-white/[0.03] transition-colors">
          <input
            type="checkbox"
            checked={stealthMode}
            onChange={(e) => setStealthMode(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-solid)] accent-brand-500"
          />
          <span className="flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              Stealth Mode
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                Live only
              </span>
            </span>
            <span className="block mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed">
              Protected compact overlay — transcripts and answers are not saved.
            </span>
          </span>
        </label>
      )}

      {/* START button */}
      <button
        onClick={startSession}
        disabled={launching}
        className="w-full py-4 rounded-2xl text-base font-semibold transition-all duration-300 disabled:opacity-60 relative overflow-hidden group
          bg-gradient-to-r from-brand-500 to-purple-500 text-white shadow-lg shadow-brand-500/25
          hover:shadow-brand-500/40 hover:scale-[1.01] active:scale-[0.99]"
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="relative flex items-center justify-center gap-3">
          {launching ? (
            <>
              <Spinner />
              Launching...
            </>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              START SESSION
            </>
          )}
        </span>
      </button>

      {/* Keyboard hint */}
      <p className="text-center text-xs text-[var(--color-text-muted)]">
        Press{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--color-border)] text-[11px] font-mono">
          Ctrl + Enter
        </kbd>{" "}
        to start quickly
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-5 h-5 text-current"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
