import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/session-store";

function SpeakingWaveform() {
  return (
    <div className="flex items-center gap-[3px] h-4 px-3 py-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-brand-400"
          style={{
            animation: `waveform 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
          }}
        />
      ))}
      <span className="ml-2 text-xs text-brand-300 animate-pulse">Listening...</span>
      <style>{`
        @keyframes waveform {
          0% { height: 4px; opacity: 0.4; }
          100% { height: 16px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function TranscriptPanel({ audioLevel = 0 }: { audioLevel?: number }) {
  const segments = useSessionStore((s) => s.segments);
  const partialText = useSessionStore((s) => s.partialText);
  const questions = useSessionStore((s) => s.questions);
  const isRecording = useSessionStore((s) => s.isRecording);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isSpeaking = audioLevel > 0.003;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, partialText]);

  const questionTexts = new Set(questions.map((q) => q.text));

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 space-y-1.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Live Transcript
        </h2>
        {isRecording && isSpeaking && (
          <span className="flex items-center gap-1 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] text-red-300 font-medium">LIVE</span>
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--color-text-muted)] bg-white/5 px-2 py-0.5 rounded-full">
          {segments.length} segments
        </span>
      </div>

      {segments.length === 0 && !partialText && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1" className="animate-pulse-soft">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">Start recording to see transcript</p>
          </div>
        </div>
      )}

      {segments.map((seg, idx) => {
        const isQuestion = questionTexts.has(seg.text);
        const isLatest = idx === segments.length - 1;
        return (
          <div
            key={seg.id}
            className={`text-sm leading-relaxed py-1.5 px-3 rounded-lg transition-all duration-500 ${
              isLatest ? "animate-slide-in" : ""
            } ${
              isQuestion
                ? "bg-brand-600/10 border-l-2 border-brand-400 ml-0"
                : "hover:bg-white/[0.02]"
            }`}
            style={isLatest ? { opacity: 1 } : undefined}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wider mr-2 ${
              seg.speaker === "user" ? "text-brand-300" : seg.speaker === "interviewer" ? "text-amber-300" : "text-[var(--color-text-muted)]"
            }`}>
              {seg.speaker === "user" ? "You" : seg.speaker === "interviewer" ? "Them" : "..."}
            </span>
            <span className={isQuestion ? "text-brand-100 font-medium" : ""}>{seg.text}</span>
          </div>
        );
      })}

      {partialText && (
        <div className="text-sm text-[var(--color-text-muted)] italic px-3 py-1.5 animate-pulse-soft">
          {partialText}
        </div>
      )}

      {isRecording && isSpeaking && !partialText && <SpeakingWaveform />}

      <div ref={bottomRef} />
    </div>
  );
}
