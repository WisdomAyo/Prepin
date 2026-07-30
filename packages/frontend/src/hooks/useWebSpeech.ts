import { useCallback, useRef, useState } from "react";

interface WebSpeechOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  lang?: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export function useWebSpeech({
  onTranscript,
  onError,
  lang = "en-US",
}: WebSpeechOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartingRef = useRef(false);

  const start = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      onError?.("Web Speech API not supported — use Chrome or Edge");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        onTranscript(text, result.isFinal);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      onError?.(event.error);
    };

    recognition.onend = () => {
      if (recognitionRef.current && !restartingRef.current) {
        restartingRef.current = true;
        try {
          recognitionRef.current.start();
        } catch {
          // already started
        }
        restartingRef.current = false;
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [onTranscript, onError, lang]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onend = null;
      rec.stop();
    }
    setIsListening(false);
  }, []);

  return { isListening, start, stop };
}
