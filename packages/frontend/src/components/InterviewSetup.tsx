import { useState } from "react";
import { useSetupStore, SCENARIO_META, type Scenario } from "@/stores/setup-store";

export function InterviewSetup() {
  const [tab, setTab] = useState<"quick" | "custom">("quick");
  const { scenario, setScenario, customPrompt, setCustomPrompt } = useSetupStore();

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
        <button
          onClick={() => setTab("quick")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            tab === "quick" ? "bg-brand-600/20 text-brand-300" : "text-[var(--color-text-muted)] hover:text-white"
          }`}
        >
          Quick Setup
          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold leading-none">
            REC
          </span>
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            tab === "custom" ? "bg-brand-600/20 text-brand-300" : "text-[var(--color-text-muted)] hover:text-white"
          }`}
        >
          Custom Prompt
        </button>
      </div>

      {tab === "quick" ? (
        <div className="space-y-4">
          {/* Scenario */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)]">
              Scenario
              <span className="w-3.5 h-3.5 rounded-full border border-[var(--color-text-muted)] text-[10px] flex items-center justify-center opacity-60">
                ?
              </span>
            </label>
            <div className="relative">
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
                className="w-full input-field appearance-none pr-10 cursor-pointer"
              >
                {Object.entries(SCENARIO_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {SCENARIO_META[scenario].description}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Technical Interview with Harbor - Cameron&#10;&#10;(Please make response very precise not too long story, just hit the nail on the head please sound like a human and be professional in your response and please make it fast)"
            className="w-full h-32 input-field resize-none text-sm leading-relaxed"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Describe the interview scenario, your preferences for response style, and any specific instructions.
          </p>
        </div>
      )}
    </div>
  );
}
