/**
 * Type declarations for the Electron preload bridge.
 *
 * These types are exposed to the renderer via contextBridge.exposeInMainWorld
 * and accessible as window.copilotDesktop.
 */

type DisplayMode = "full" | "compact" | "presentation";

interface CopilotDesktopAPI {
  /** Set overlay window opacity (0.1 - 1.0). */
  setOverlayOpacity: (opacity: number) => void;

  /** Check if overlay is currently visible. */
  isOverlayVisible: () => Promise<boolean>;

  /** Send data to the overlay renderer. */
  sendToOverlay: (data: unknown) => void;

  /** Set overlay display mode. */
  setMode: (mode: DisplayMode) => void;

  /** Get current overlay display mode. */
  getMode: () => Promise<DisplayMode>;

  /** Enable or disable stealth/privacy profile behavior. */
  setStealthMode: (enabled: boolean) => void;

  /** Get current stealth/privacy profile state. */
  getStealthMode: () => Promise<boolean>;

  /** Register callback for global recording toggle hotkey. */
  onToggleRecording: (callback: () => void) => void;

  /** Register callback for global stealth-mode hotkey changes. */
  onStealthModeChanged: (callback: (enabled: boolean) => void) => void;

  /** Register callback for overlay data updates. */
  onOverlayData: (callback: (data: unknown) => void) => void;

  /** Get system audio stream (triggers display media picker). */
  getDisplayMedia: () => Promise<MediaStream>;

  /** Current platform (win32, darwin, linux). */
  platform: NodeJS.Platform;
}

interface Window {
  copilotDesktop?: CopilotDesktopAPI;
}
