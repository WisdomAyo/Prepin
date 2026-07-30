export function AssessmentPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Online Assessment</span>
          </h1>
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-bold">
            BETA
          </span>
        </div>
        <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
          AI assistance for coding assessments. Screenshot questions and get
          grounded solutions with explanations.
        </p>
      </header>

      <div className="card p-10 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-600/10 flex items-center justify-center ring-1 ring-amber-500/20">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Coming Soon</h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          Coding assessment mode will help you solve problems by analyzing screenshots
          of coding questions and providing step-by-step solutions.
        </p>
      </div>
    </div>
  );
}
