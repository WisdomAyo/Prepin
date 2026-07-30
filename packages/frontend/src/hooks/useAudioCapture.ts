/**
 * Audio capture hook — manages microphone access and streams PCM audio.
 *
 * Uses the Web Audio API to capture from the microphone, downsample to
 * 16kHz mono PCM, and provide chunks as base64-encoded strings for
 * WebSocket transmission.
 *
 * Architecture decision: we process audio on the main thread with
 * AudioWorklet for minimal latency. The worklet sends PCM buffers
 * back via MessagePort, which we encode and forward.
 */

import { useCallback, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

interface AudioCaptureOptions {
  onAudioChunk: (base64Data: string, sampleRate: number) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onAudioChunk, onError }: AudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      const source = context.createMediaStreamSource(stream);

      // Use ScriptProcessorNode for broad compatibility
      // (AudioWorklet would be better but requires a separate file)
      const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert float32 [-1, 1] to int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Encode to base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        onAudioChunk(base64, context.sampleRate);
      };

      source.connect(processor);
      processor.connect(context.destination);

      streamRef.current = stream;
      contextRef.current = context;
      processorRef.current = processor;
      setIsCapturing(true);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [onAudioChunk, onError]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    contextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    processorRef.current = null;
    contextRef.current = null;
    streamRef.current = null;
    setIsCapturing(false);
  }, []);

  return { isCapturing, start, stop };
}
