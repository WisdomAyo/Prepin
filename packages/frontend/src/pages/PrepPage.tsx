import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAudioCapture } from "@/hooks/useAudioCapture";

interface QAPair {
  question: string;
  answer: string;
}

const PREP_QUESTIONS = [
  "Tell me about yourself and why you're interested in this role.",
  "Describe a challenging project you led. What was the outcome?",
  "How do you handle disagreements with team members?",
  "What's your approach to learning new technologies?",
  "Where do you see yourself in five years?",
];

export function PrepPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(PREP_QUESTIONS[0]);
  const [userAnswer, setUserAnswer] = useState("");
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  function submitAnswer() {
    if (!userAnswer.trim()) return;
    const pair: QAPair = { question: currentQuestion, answer: userAnswer };
    const allPairs = [...qaPairs, pair];
    setQaPairs(allPairs);
    setUserAnswer("");

    const next = questionIndex + 1;
    if (next < PREP_QUESTIONS.length) {
      setQuestionIndex(next);
      setCurrentQuestion(PREP_QUESTIONS[next]);
    } else {
      generateScorecard(allPairs);
    }
  }

  async function generateScorecard(pairs: QAPair[]) {
    setIsScoring(true);
    try {
      const res = await fetch("/api/v1/scoring/scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || "00000000-0000-0000-0000-000000000000",
          answers: pairs.map((p) => ({ question: p.question, user_answer: p.answer })),
        }),
      });
      if (res.ok) setScorecard(await res.json());
    } catch (err) {
      console.error("Scoring failed:", err);
    } finally {
      setIsScoring(false);
    }
  }

  const handleAudioChunk = useCallback(() => {}, []);
  const { isCapturing, start: startMic, stop: stopMic } = useAudioCapture({ onAudioChunk: handleAudioChunk });

  if (scorecard) return <ScorecardView scorecard={scorecard} onBack={() => navigate("/")} />;

  const progress = ((questionIndex + (userAnswer ? 0 : 0)) / PREP_QUESTIONS.length) * 100;

  return (
    <div className="p-8 pb-16 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between animate-fade-in">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">Prep Mode</span>
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">AI mock interview with scoring</p>
        </div>
        <button onClick={() => navigate("/")} className="btn-ghost text-xs">
          Exit
        </button>
      </header>

      {/* Progress bar */}
      <div className="space-y-2 animate-fade-in">
        <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
          <span>Question {questionIndex + 1} of {PREP_QUESTIONS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-purple-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-1">
          {PREP_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                i < questionIndex
                  ? "bg-brand-500"
                  : i === questionIndex
                    ? "bg-brand-400"
                    : "bg-white/5"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="card p-7 space-y-2 animate-fade-in-up">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600/10 flex items-center justify-center text-brand-300 text-xs font-bold">
            {questionIndex + 1}
          </div>
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Interview Question
          </span>
        </div>
        <p className="text-lg font-medium leading-relaxed">{currentQuestion}</p>
      </div>

      {/* Answer input */}
      <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Type your answer here... Be specific, use examples, and keep it structured."
          rows={7}
          className="input-field !rounded-2xl !px-5 !py-4 resize-none text-base leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
          }}
        />

        <div className="flex items-center justify-between">
          <button
            onClick={isCapturing ? stopMic : startMic}
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <span className={`w-2 h-2 rounded-full transition-colors ${
              isCapturing ? "bg-red-400 animate-pulse" : "bg-white/20"
            }`} />
            {isCapturing ? "Stop mic" : "Use mic"}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-text-muted)]">Ctrl+Enter</span>
            <button
              onClick={submitAnswer}
              disabled={!userAnswer.trim() || isScoring}
              className="btn-primary disabled:opacity-40 flex items-center gap-2"
            >
              {isScoring ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Scoring...
                </>
              ) : questionIndex === PREP_QUESTIONS.length - 1 ? (
                "Submit & Score"
              ) : (
                "Next Question"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Previous Q&As */}
      {qaPairs.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-[var(--color-border)] animate-fade-in">
          <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Your Answers ({qaPairs.length})
          </h3>
          {qaPairs.map((pair, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="badge-brand text-[10px] mt-0.5">Q{i + 1}</span>
                <p className="text-sm text-brand-200 font-medium leading-snug">{pair.question}</p>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] pl-8 leading-relaxed">{pair.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scorecard View ────────────────────────────────────────────

interface Scorecard {
  average_score: number;
  weakest_dimension: string;
  drill_recommendations: string[];
  answers: Array<{
    question: string;
    overall_score: number;
    improvement_tip: string;
    dimensions: Array<{ dimension: string; score: number; feedback: string }>;
  }>;
}

function ScorecardView({ scorecard: sc, onBack }: { scorecard: Scorecard; onBack: () => void }) {
  const scoreColor = sc.average_score >= 4 ? "text-emerald-400" : sc.average_score >= 3 ? "text-brand-400" : "text-amber-400";

  return (
    <div className="p-8 pb-16 max-w-3xl mx-auto space-y-8">
      <header className="flex items-center justify-between animate-fade-in">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">Session Scorecard</span>
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">Detailed performance analysis</p>
        </div>
        <button onClick={onBack} className="btn-ghost text-xs">Back to Dashboard</button>
      </header>

      {/* Overall score */}
      <div className="card p-8 text-center animate-scale-in">
        <div className="relative inline-block">
          <p className={`text-7xl font-bold ${scoreColor}`}>
            {sc.average_score.toFixed(1)}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">out of 5.0</p>
        </div>
        <div className="mt-4 inline-flex items-center gap-2">
          <span className="badge-warning">Focus area</span>
          <span className="text-sm">{sc.weakest_dimension}</span>
        </div>
      </div>

      {/* Per-answer */}
      <div className="space-y-4">
        {sc.answers.map((a, i) => (
          <div key={i} className="card p-5 space-y-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <span className="badge-brand text-[10px] mt-0.5">Q{i + 1}</span>
                <p className="text-sm font-medium text-brand-200 leading-snug">{a.question}</p>
              </div>
              <span className={`text-2xl font-bold shrink-0 ${
                a.overall_score >= 4 ? "text-emerald-400" : a.overall_score >= 3 ? "text-brand-400" : "text-amber-400"
              }`}>
                {a.overall_score.toFixed(1)}
              </span>
            </div>

            {/* Dimension scores */}
            <div className="grid grid-cols-5 gap-3">
              {a.dimensions.map((d) => (
                <div key={d.dimension} className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">{d.dimension}</p>
                  <p className="text-sm font-bold mt-0.5">{d.score}<span className="text-[var(--color-text-muted)] font-normal">/5</span></p>
                </div>
              ))}
            </div>

            {a.improvement_tip && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" className="mt-0.5 shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
                <p className="text-xs text-amber-200/80 leading-relaxed">{a.improvement_tip}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drill recs */}
      {sc.drill_recommendations?.length > 0 && (
        <div className="card p-5 space-y-3 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            </div>
            <h3 className="text-sm font-semibold">Drill Recommendations</h3>
          </div>
          <ul className="space-y-2 pl-1">
            {sc.drill_recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
