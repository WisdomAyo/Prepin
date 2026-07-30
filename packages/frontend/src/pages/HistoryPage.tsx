import { useNavigate } from "react-router-dom";
import { useScoreHistory } from "@/hooks/useApi";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export function HistoryPage() {
  const navigate = useNavigate();
  const { data: entries, isLoading } = useScoreHistory(DEFAULT_USER_ID);

  return (
    <div className="p-8 pb-16 max-w-4xl mx-auto space-y-8">
      <header className="space-y-1 animate-fade-in">
        <h1 className="text-2xl font-bold">
          <span className="gradient-text">Score History</span>
        </h1>
        <p className="text-xs text-[var(--color-text-muted)]">Track your interview performance over time</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      ) : !entries || entries.length === 0 ? (
        <div className="card p-16 text-center animate-fade-in-up">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-white/5 flex items-center justify-center animate-float">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1" strokeLinecap="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <p className="text-lg font-medium mb-1">No sessions scored yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Complete a Prep Mode session to see your progress here.</p>
          <button onClick={() => navigate("/prep")} className="btn-primary">
            Start Practice Session
          </button>
        </div>
      ) : (
        <>
          {/* Score trend chart */}
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-600/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
                </div>
                <h2 className="text-sm font-semibold">Score Trend</h2>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{entries.length} sessions</span>
            </div>

            <div className="flex items-end gap-2 h-40">
              {entries.map((entry, i) => {
                const pct = (entry.average_score / 5) * 100;
                const color = entry.average_score >= 4
                  ? "from-emerald-500 to-emerald-400"
                  : entry.average_score >= 3
                    ? "from-brand-600 to-brand-400"
                    : "from-amber-600 to-amber-400";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-xs font-mono font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.average_score.toFixed(1)}
                    </span>
                    <div
                      className={`w-full bg-gradient-to-t ${color} rounded-t-lg transition-all duration-500 ease-out group-hover:opacity-90`}
                      style={{
                        height: `${pct}%`,
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                    <span className="text-[9px] text-[var(--color-text-muted)]">
                      {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session list */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              All Sessions
            </h3>
            {entries.map((entry, i) => {
              const scoreColor = entry.average_score >= 4 ? "text-emerald-400" : entry.average_score >= 3 ? "text-brand-400" : "text-amber-400";
              return (
                <div
                  key={i}
                  className="card-interactive p-5 flex items-center justify-between animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <span className="text-sm font-bold">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Session — {new Date(entry.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="badge-warning text-[10px]">{entry.weakest_dimension}</span>
                        {entry.dimension_averages && (
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {Object.keys(entry.dimension_averages).length} dimensions scored
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${scoreColor}`}>
                      {entry.average_score.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">/ 5.0</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
