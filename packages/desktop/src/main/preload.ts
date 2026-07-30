/**
 * Preload script — minimal bridge between main and renderer.
 *
 * Security: contextIsolation=true, nodeIntegration=false.
 * Only expose the specific APIs the renderer needs.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("copilotDesktop", {
  // Overlay control
  setOverlayOpacity: (opacity: number) =>
    ipcRenderer.send("set-overlay-opacity", opacity),

  isOverlayVisible: () => ipcRenderer.invoke("get-overlay-visible"),

  sendToOverlay: (data: unknown) =>
    ipcRenderer.send("send-to-overlay", data),

  // Mode control
  setMode: (mode: string) => ipcRenderer.send("set-mode", mode),
  getMode: () => ipcRenderer.invoke("get-mode"),

  // Stealth/privacy profile control
  setStealthMode: (enabled: boolean) =>
    ipcRenderer.send("set-stealth-mode", enabled),
  getStealthMode: () => ipcRenderer.invoke("get-stealth-mode"),

  // Recording toggle (from global hotkey)
  onToggleRecording: (callback: () => void) =>
    ipcRenderer.on("toggle-recording", callback),

  onStealthModeChanged: (callback: (enabled: boolean) => void) =>
    ipcRenderer.on("stealth-mode-changed", (_event, enabled) => callback(enabled)),

  // Overlay data receiver
  onOverlayData: (callback: (data: unknown) => void) =>
    ipcRenderer.on("overlay-data", (_event, data) => callback(data)),

  // System audio capture
  getDisplayMedia: async (): Promise<MediaStream> => {
    return navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: false,
    } as DisplayMediaStreamOptions);
  },

  // Platform info
  platform: process.platform,
});
