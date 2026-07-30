export function MeetingPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Professional Meeting</span>
        </h1>
        <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
          AI-powered assistance for consented sales calls and professional meetings.
          Get real-time talking points grounded in your uploaded context.
        </p>
      </header>

      <div className="card p-10 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-600/10 flex items-center justify-center ring-1 ring-brand-500/20">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Coming Soon</h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          Professional meeting mode will provide real-time assistance during consented sales calls and meetings
          with context from your uploaded documents.
        </p>
      </div>
    </div>
  );
}
