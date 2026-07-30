import { useSessionStore } from "@/stores/session-store";
import { AnswerCard } from "./AnswerCard";

export function AnswerOverlay() {
  const currentAnswer = useSessionStore((s) => s.currentAnswer);
  const answers = useSessionStore((s) => s.answers);
  const stealthMode = useSessionStore((s) => s.stealthMode);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-emerald-600/10 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
        </div>
        <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Suggested Answers
        </h2>
        {!stealthMode && answers.length > 0 && (
          <span className="ml-auto text-[10px] text-[var(--color-text-muted)] bg-white/5 px-2 py-0.5 rounded-full">
            {answers.length} answers
          </span>
        )}
      </div>

      {currentAnswer ? (
        <AnswerCard answer={currentAnswer} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center animate-float">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Listening for questions...</p>
              <p className="text-xs text-[var(--color-text-muted)] opacity-60 mt-0.5">Answers appear here in real-time</p>
            </div>
          </div>
        </div>
      )}

      {/* Previous answers */}
      {!stealthMode && answers.length > 1 && (
        <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
          <h3 className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
            Previous
          </h3>
          {answers.slice(0, -1).reverse().map((a, i) => (
            <AnswerCard key={i} answer={a} compact />
          ))}
        </div>
      )}
    </div>
  );
}
