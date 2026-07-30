import { useSetupStore } from "@/stores/setup-store";

export function AdvancedSettings() {
  const {
    imageAnalysisContext,
    setImageAnalysisContext,
    speechReflection,
    setSpeechReflection,
  } = useSetupStore();

  return (
    <div className="space-y-5">
      {/* Image Analysis Context */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Image Analysis Context</label>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-[var(--color-text-muted)] border border-[var(--color-border)]">
            OPTIONAL
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Help the AI focus on specific details in screenshots.
        </p>
        <textarea
          value={imageAnalysisContext}
          onChange={(e) => setImageAnalysisContext(e.target.value)}
          placeholder="E.g. 'Prioritize system design diagrams' or 'Focus on the candidate's reasoning, not the UI.'"
          className="w-full h-20 input-field resize-none text-sm"
        />
      </div>

      {/* Speech Reflection */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02]">
        <div className="space-y-1">
          <p className="text-sm font-medium">Speech Reflection</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Analyzes structure, clarity, confidence, and impact.
          </p>
        </div>
        <ToggleSwitch checked={speechReflection} onChange={setSpeechReflection} />
      </div>

      {/* Q&A Prep */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02]">
        <div className="space-y-1">
          <p className="text-sm font-medium">Q&A Prep</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Prepare answers in advance for faster, more confident responses.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.07] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Configure
        </button>
      </div>

      {/* Screenshot Capture */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-brand-500/20 bg-brand-600/5">
        <div className="space-y-1">
          <p className="text-sm font-medium flex items-center gap-2">
            Screenshot Analysis
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
              NEW
            </span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Capture your screen during interviews. AI analyzes diagrams, code, and questions from screenshots.
          </p>
        </div>
        <ToggleSwitch checked={true} onChange={() => {}} />
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? "bg-brand-500" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
