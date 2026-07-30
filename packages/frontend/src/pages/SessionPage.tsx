import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSessionStore } from "@/stores/session-store";
import { useSessionSocket } from "@/hooks/useSessionSocket";
import { useSystemAudio } from "@/hooks/useSystemAudio";
import { useScreenshot } from "@/hooks/useScreenshot";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { AnswerOverlay } from "@/components/AnswerOverlay";
import { RecordingControls } from "@/components/RecordingControls";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { setIsRecording, setSessionId, stealthMode } = useSessionStore();
  const { sendSpeechSegment, sendControl } = useSessionSocket(
    sessionId ?? null,
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) setSessionId(sessionId);
  }, [sessionId, setSessionId]);

  const stableSendSegment = useRef(sendSpeechSegment);
  stableSendSegment.current = sendSpeechSegment;

  const onSpeechSegment = useCallback((base64Pcm: string) => {
    stableSendSegment.current(base64Pcm);
  }, []);

  const onLevel = useCallback((rms: number) => {
    setAudioLevel(rms);
  }, []);

  const onError = useCallback((err: string) => {
    setCaptureError(err);
  }, []);

  const { isCapturing, start: startCapture, stop: stopCapture } =
    useSystemAudio({ onSpeechSegment, onLevel, onError });

  const {
    capturing: screenshotCapturing,
    result: screenshotResult,
    error: screenshotError,
    captureAndAnalyze,
    clearResult: clearScreenshot,
  } = useScreenshot(sessionId ?? null);

  function handleStart() {
    setCaptureError(null);
    startCapture();
    setIsRecording(true);
  }

  function handleStop() {
    stopCapture();
    setIsRecording(false);
  }

  function handleEnd() {
    stopCapture();
    sendControl("end");
    setIsRecording(false);
    navigate("/");
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="flex items-center justify-between px-6 py-3 glass border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="btn-ghost !px-2.5 !py-1.5 text-xs"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-px h-5 bg-[var(--color-border)]" />
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-glow-pulse ${stealthMode ? "bg-emerald-400" : "bg-brand-400"}`} />
            <h1 className="text-sm font-semibold">Live Session</h1>
            {stealthMode && (
              <span className="badge bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20">
                Stealth
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => captureAndAnalyze()}
            disabled={screenshotCapturing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-500/30 bg-brand-600/10 text-brand-300 hover:bg-brand-600/20 transition-colors disabled:opacity-50"
            title="Capture screenshot for AI analysis"
          >
            {screenshotCapturing ? (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M3 9h2M19 9h2M9 3v2M9 19v2M15 3v2M15 19v2M3 15h2M19 15h2" />
              </svg>
            )}
            Screenshot
          </button>
          <span className="font-mono text-xs text-[var(--color-text-muted)] bg-white/5 px-2.5 py-1 rounded-lg">
            {sessionId?.slice(0, 8)}
          </span>
        </div>
      </header>

      {(captureError || screenshotError) && (
        <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {captureError || screenshotError}
        </div>
      )}

      {screenshotResult && (
        <div className="mx-6 mt-3 p-4 rounded-xl border border-brand-500/20 bg-brand-600/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-brand-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Screenshot Analysis
            </div>
            <button onClick={clearScreenshot} className="text-xs text-[var(--color-text-muted)] hover:text-white">
              Dismiss
            </button>
          </div>
          <p className="text-sm font-semibold">{screenshotResult.headline}</p>
          <ul className="space-y-1">
            {screenshotResult.bullets.map((b, i) => (
              <li key={i} className="text-sm text-[var(--color-text-muted)] flex gap-2">
                <span className="text-brand-400 shrink-0">•</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {!stealthMode && (
          <div className="w-1/2 border-r border-[var(--color-border)] overflow-hidden">
            <TranscriptPanel audioLevel={audioLevel} />
          </div>
        )}
        {stealthMode && (
          <div className="w-1/2 border-r border-[var(--color-border)] overflow-hidden p-6 flex items-center justify-center">
            <div className="max-w-sm text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-600/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Stealth mode active</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                  Transcript and answer history are not persisted for this session.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="w-1/2 overflow-hidden">
          <AnswerOverlay />
        </div>
      </div>

      <RecordingControls
        onStart={handleStart}
        onStop={handleStop}
        onEnd={handleEnd}
        audioLevel={audioLevel}
        isCapturing={isCapturing}
      />
    </div>
  );
}
