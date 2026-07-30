import { useCallback, useState } from "react";

declare class ImageCapture {
  constructor(track: MediaStreamTrack);
  grabFrame(): Promise<ImageBitmap>;
}

interface ScreenshotResult {
  headline: string;
  bullets: string[];
  spokenVersion?: string;
}

const API_BASE = "/api/v1";

export function useScreenshot(sessionId: string | null) {
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const captureAndAnalyze = useCallback(
    async (question?: string, context?: string) => {
      setCapturing(true);
      setError(null);
      setResult(null);

      try {
        const imageBlob = await captureScreen();
        if (!imageBlob) {
          setError("Screen capture was cancelled or unavailable.");
          setCapturing(false);
          return;
        }

        const form = new FormData();
        form.append("image", imageBlob, "screenshot.png");
        if (question) form.append("question", question);
        if (context) form.append("context", context);

        const res = await fetch(`${API_BASE}/screenshot/analyze`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Screenshot analysis failed (${res.status})`);
        }

        const data = await res.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Screenshot analysis failed");
      } finally {
        setCapturing(false);
      }
    },
    [],
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { capturing, result, error, captureAndAnalyze, clearResult };
}

async function captureScreen(): Promise<Blob | null> {
  // Electron: use desktopCapturer if available
  const electronCapture = (window as Window & { electronCapture?: () => Promise<string> }).electronCapture;
  if (electronCapture) {
    const base64 = await electronCapture();
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  // Browser: use getDisplayMedia
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "monitor" } as MediaTrackConstraints,
    });

    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();

    track.stop();
    stream.getTracks().forEach((t) => t.stop());

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}
