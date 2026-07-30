import { useCallback, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;
const SILENCE_THRESHOLD = 0.003;
const SILENCE_DURATION_MS = 500;
const MIN_SPEECH_SAMPLES = TARGET_SAMPLE_RATE * 0.3;
const MAX_CHUNK_DURATION_S = 2.5;
const MAX_CHUNK_SAMPLES = TARGET_SAMPLE_RATE * MAX_CHUNK_DURATION_S;

interface SystemAudioOptions {
  onSpeechSegment: (base64Pcm: string) => void;
  onLevel: (rms: number) => void;
  onError: (err: string) => void;
}

function downsample(buf: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return buf;
  const ratio = from / to;
  const len = Math.round(buf.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const si = i * ratio;
    const lo = Math.floor(si);
    const hi = Math.min(lo + 1, buf.length - 1);
    const f = si - lo;
    out[i] = buf[lo] * (1 - f) + buf[hi] * f;
  }
  return out;
}

function float32ToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function flushChunks(chunks: Int16Array[]): string | null {
  const totalSamples = chunks.reduce((s, c) => s + c.length, 0);
  if (totalSamples < MIN_SPEECH_SAMPLES) return null;
  const combined = new Int16Array(totalSamples);
  let off = 0;
  for (const c of chunks) {
    combined.set(c, off);
    off += c.length;
  }
  return int16ToBase64(combined);
}

export function useSystemAudio({ onSpeechSegment, onLevel, onError }: SystemAudioOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1, height: 1, frameRate: 1 },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      } as DisplayMediaStreamOptions);

      stream.getVideoTracks().forEach((t) => t.stop());

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach((t) => t.stop());
        onError(
          "No audio captured. Share your Entire Screen and check 'Share system audio', or share a Chrome Tab.",
        );
        return;
      }

      const audioStream = new MediaStream([audioTrack]);
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(audioStream);
      const proc = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const nativeSR = ctx.sampleRate;

      let speechChunks: Int16Array[] = [];
      let totalSpeechSamples = 0;
      let speaking = false;
      let silenceStart = 0;

      proc.onaudioprocess = (e) => {
        const raw = e.inputBuffer.getChannelData(0);

        let sumSq = 0;
        for (let i = 0; i < raw.length; i++) sumSq += raw[i] * raw[i];
        const rms = Math.sqrt(sumSq / raw.length);
        onLevel(rms);

        const resampled = downsample(raw, nativeSR, TARGET_SAMPLE_RATE);
        const pcm = float32ToInt16(resampled);

        if (rms > SILENCE_THRESHOLD) {
          speaking = true;
          silenceStart = 0;
          speechChunks.push(pcm);
          totalSpeechSamples += pcm.length;

          if (totalSpeechSamples >= MAX_CHUNK_SAMPLES) {
            const b64 = flushChunks(speechChunks);
            if (b64) onSpeechSegment(b64);
            speechChunks = [];
            totalSpeechSamples = 0;
          }
        } else if (speaking) {
          speechChunks.push(pcm);
          totalSpeechSamples += pcm.length;
          if (!silenceStart) silenceStart = performance.now();

          if (performance.now() - silenceStart >= SILENCE_DURATION_MS) {
            const b64 = flushChunks(speechChunks);
            if (b64) onSpeechSegment(b64);
            speechChunks = [];
            totalSpeechSamples = 0;
            speaking = false;
            silenceStart = 0;
          }
        }
      };

      audioTrack.onended = () => {
        setIsCapturing(false);
      };

      source.connect(proc);
      proc.connect(ctx.destination);

      streamRef.current = audioStream;
      ctxRef.current = ctx;
      procRef.current = proc;
      setIsCapturing(true);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        onError("Screen share cancelled — click Start and share a screen with audio");
      } else {
        onError(err?.message || "Failed to capture system audio");
      }
    }
  }, [onSpeechSegment, onLevel, onError]);

  const stop = useCallback(() => {
    procRef.current?.disconnect();
    ctxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    procRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
    setIsCapturing(false);
  }, []);

  return { isCapturing, start, stop };
}
