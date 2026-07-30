"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("copilotDesktop", {
  // Overlay control
  setOverlayOpacity: (opacity) => electron.ipcRenderer.send("set-overlay-opacity", opacity),
  isOverlayVisible: () => electron.ipcRenderer.invoke("get-overlay-visible"),
  sendToOverlay: (data) => electron.ipcRenderer.send("send-to-overlay", data),
  // Mode control
  setMode: (mode) => electron.ipcRenderer.send("set-mode", mode),
  getMode: () => electron.ipcRenderer.invoke("get-mode"),
  // Stealth/privacy profile control
  setStealthMode: (enabled) => electron.ipcRenderer.send("set-stealth-mode", enabled),
  getStealthMode: () => electron.ipcRenderer.invoke("get-stealth-mode"),
  // Recording toggle (from global hotkey)
  onToggleRecording: (callback) => electron.ipcRenderer.on("toggle-recording", callback),
  onStealthModeChanged: (callback) => electron.ipcRenderer.on("stealth-mode-changed", (_event, enabled) => callback(enabled)),
  // Overlay data receiver
  onOverlayData: (callback) => electron.ipcRenderer.on("overlay-data", (_event, data) => callback(data)),
  // System audio capture
  getDisplayMedia: async () => {
    return navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: false
    });
  },
  // Platform info
  platform: process.platform
});
