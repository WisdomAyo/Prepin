/**
 * WebSocket hook for real-time session communication.
 *
 * Manages the WebSocket lifecycle and dispatches incoming messages
 * to the session store. Provides methods to send audio chunks
 * and control messages.
 */

import { useCallback, useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/session-store";

const WS_BASE = `ws://${window.location.host}/ws`;

type CopilotDesktopBridge = {
  sendToOverlay?: (data: unknown) => void;
  setStealthMode?: (enabled: boolean) => void;
};

function desktopBridge(): CopilotDesktopBridge | undefined {
  return (window as Window & { copilotDesktop?: CopilotDesktopBridge }).copilotDesktop;
}

export function useSessionSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const {
    setStatus,
    addSegment,
    setPartialText,
    addQuestion,
    addAnswer,
    setStealthMode,
  } = useSessionStore();

  // Connect
  useEffect(() => {
    if (!sessionId) return;

    setStatus("connecting");
    const url = `${WS_BASE}/session/${sessionId}`;
    console.log("[ws] Connecting to:", url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[ws] Connected");
      setStatus("connected");
    };

    ws.onclose = (e) => {
      console.log("[ws] Closed:", e.code, e.reason);
      setStatus("disconnected");
    };

    ws.onerror = (e) => {
      console.error("[ws] Error:", e);
      setStatus("error");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        console.error("Failed to parse WS message");
      }
    };

    return () => {
      desktopBridge()?.setStealthMode?.(false);
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMessage(msg: { type: string; payload: unknown }) {
    switch (msg.type) {
      case "transcript": {
        if (useSessionStore.getState().stealthMode) break;
        const p = msg.payload as {
          sessionId: string;
          speaker: "user" | "interviewer" | "unknown";
          text: string;
          startMs: number;
          isFinal: boolean;
        };
        if (p.isFinal) {
          addSegment({
            id: crypto.randomUUID(),
            speaker: p.speaker,
            text: p.text,
            startMs: p.startMs,
            isFinal: true,
          });
        } else {
          setPartialText(p.text);
        }
        break;
      }

      case "question_detected": {
        const q = msg.payload as {
          text: string;
          confidence: number;
          timestampMs: number;
        };
        addQuestion(q);
        break;
      }

      case "answer": {
        const answer = msg.payload as Parameters<typeof addAnswer>[0];
        addAnswer(answer);
        desktopBridge()?.sendToOverlay?.({ type: "answer", payload: answer });
        break;
      }

      case "session_settings": {
        const settings = msg.payload as {
          stealthMode: boolean;
          transcriptVisible: boolean;
          answerPersistence: boolean;
        };
        setStealthMode(settings.stealthMode);
        desktopBridge()?.setStealthMode?.(settings.stealthMode);
        desktopBridge()?.sendToOverlay?.({
          type: "session_settings",
          payload: settings,
        });
        break;
      }

      case "error": {
        const e = msg.payload as { code: string; message: string };
        console.error(`Session error [${e.code}]: ${e.message}`);
        break;
      }
    }
  }

  // Send text transcript from browser Speech API
  const sendTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "transcript_text",
            text,
            isFinal,
            timestampMs: Date.now(),
          }),
        );
      }
    },
    [],
  );

  const sendSpeechSegment = useCallback(
    (base64Pcm: string) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        console.log("[ws] Sending speech_segment, size:", base64Pcm.length);
        ws.send(
          JSON.stringify({
            type: "speech_segment",
            data: base64Pcm,
            sampleRate: 16000,
            timestampMs: Date.now(),
          }),
        );
      } else {
        console.warn("[ws] Cannot send — socket state:", ws?.readyState ?? "null");
      }
    },
    [],
  );

  const sendControl = useCallback(
    (type: "pause" | "resume" | "end") => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type }));
      }
    },
    [],
  );

  return { sendSpeechSegment, sendTranscript, sendControl };
}
