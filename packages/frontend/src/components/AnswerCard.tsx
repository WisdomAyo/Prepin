import type { GroundedAnswer } from "@/stores/session-store";

interface AnswerCardProps {
  answer: GroundedAnswer;
  compact?: boolean;
}

export function AnswerCard({ answer, compact = false }: AnswerCardProps) {
  return (
    <div className={`rounded-xl overflow-hidden transition-all duration-300 animate-slide-in-right ${
      compact ? "glass" : "glass gradient-border"
    }`}>
      {/* Question trigger */}
      <div className="px-4 py-2.5 bg-brand-600/5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Question detected</p>
        </div>
        <p className="text-sm text-brand-200 font-medium leading-snug">{answer.triggerText}</p>
      </div>

      {/* Headline */}
      <div className="px-4 pt-3 pb-1.5">
        <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
          {answer.headline}
        </h3>
      </div>

      {/* Bullets */}
      <ul className="px-4 pb-3 space-y-2">
        {answer.bullets.filter(Boolean).map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Spoken version */}
      {answer.spokenVersion && !compact && (
        <div className="mx-4 mb-3 p-3 rounded-lg bg-brand-600/5 border border-brand-500/10">
          <p className="text-[10px] font-medium text-brand-300 uppercase tracking-wider mb-1">Say this</p>
          <p className="text-sm italic text-brand-100/80 leading-relaxed">{answer.spokenVersion}</p>
        </div>
      )}

      {/* Meta */}
      <div className="px-4 py-2 bg-white/[0.02] flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
        <span className="font-mono">{answer.latencyMs}ms</span>
        <span>{answer.provider}</span>
        {answer.hasAssumptions && (
          <span className="badge-warning !text-[10px] !px-1.5 !py-0">assumptions</span>
        )}
        <span className="ml-auto">
          {answer.groundingSources.length} source{answer.groundingSources.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
