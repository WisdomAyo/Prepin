import { useSessionStore } from "@/stores/session-store";

interface RecordingControlsProps {
  onStart: () => void;
  onStop: () => void;
  onEnd: () => void;
  audioLevel: number;
  isCapturing: boolean;
}

export function RecordingControls({
  onStart,
  onStop,
  onEnd,
  audioLevel,
  isCapturing,
}: RecordingControlsProps) {
  const isRecording = useSessionStore((s) => s.isRecording);
  const status = useSessionStore((s) => s.status);
  const segments = useSessionStore((s) => s.segments);
  const questions = useSessionStore((s) => s.questions);
  const stealthMode = useSessionStore((s) => s.stealthMode);

  const levelWidth = Math.min(100, Math.round(audioLevel * 3000));

  return (
    <div className="flex items-center gap-4 px-6 py-3 glass border-t border-[var(--color-border)]">
      <button
        onClick={isRecording ? onStop : onStart}
        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.97] ${
          isRecording
            ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
            : "btn-primary"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            isRecording ? "bg-white animate-pulse" : "bg-white/50"
          }`}
        />
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      <button onClick={onEnd} className="btn-ghost text-xs">
        End Session
      </button>

      {isCapturing && (
        <div className="flex items-center gap-2.5">
          <div className="flex items-end gap-[2px] h-5">
            {Array.from({ length: 12 }).map((_, i) => {
              const barHeight = Math.max(
                2,
                Math.min(20, audioLevel * 2000 * (0.5 + 0.5 * Math.sin(Date.now() / 200 + i * 0.8))),
              );
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full transition-all duration-75"
                  style={{
                    height: `${barHeight}px`,
                    background:
                      barHeight > 14
                        ? "#f87171"
                        : barHeight > 7
                          ? "#fbbf24"
                          : "#34d399",
                    opacity: 0.6 + (barHeight / 20) * 0.4,
                  }}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
            System Audio
          </span>
        </div>
      )}

      {stealthMode && (
        <span className="badge bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20">
          Stealth
        </span>
      )}

      <div className="ml-auto flex items-center gap-5 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              status === "connected"
                ? "bg-emerald-400"
                : status === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-400"
            }`}
          />
          <span className="capitalize">{status}</span>
        </span>
        <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {segments.length}
        </span>
        <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          </svg>
          {questions.length}
        </span>
      </div>
    </div>
  );
}
