"use strict";
const electron = require("electron");
const path = require("path");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
let mainWindow = null;
let overlayWindow = null;
let currentMode = "full";
let previousModeBeforeStealth = null;
let previousOpacityBeforeStealth = null;
let stealthMode = false;
const MODES = ["full", "compact", "presentation"];
const MODE_SIZES = {
  full: { width: 400, height: 300 },
  compact: { width: 350, height: 44 },
  presentation: { width: 520, height: 400 }
};
const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_URL = "http://localhost:5173";
function rendererPath(...segments) {
  if (isDev) {
    return path__namespace.join(__dirname, "../renderer", ...segments);
  }
  return path__namespace.join(process.resourcesPath, "renderer", ...segments);
}
function createMainWindow() {
  const win = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path__namespace.join(__dirname, "../preload/index.js"),
      sandbox: true
    },
    title: "Interview Copilot",
    backgroundColor: "#0a0a0f",
    icon: isDev ? void 0 : path__namespace.join(process.resourcesPath, "icon.ico")
  });
  if (isDev) {
    win.loadURL(VITE_DEV_URL);
  } else {
    win.loadFile(rendererPath("index.html"));
  }
  return win;
}
let isClickThrough = false;
function resizeOverlayForMode(mode) {
  if (!overlayWindow) return;
  const size = MODE_SIZES[mode];
  const bounds = overlayWindow.getBounds();
  overlayWindow.setBounds({ x: bounds.x, y: bounds.y, ...size });
}
function sendOverlayData(data) {
  overlayWindow?.webContents.send("overlay-data", data);
}
function applyStealthMode(enabled) {
  stealthMode = enabled;
  mainWindow?.setContentProtection(enabled);
  overlayWindow?.setContentProtection(enabled);
  if (!overlayWindow) {
    mainWindow?.webContents.send("stealth-mode-changed", enabled);
    return;
  }
  overlayWindow.setSkipTaskbar(enabled);
  overlayWindow.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled });
  overlayWindow.setAlwaysOnTop(true, enabled ? "screen-saver" : "floating");
  if (enabled) {
    previousModeBeforeStealth = previousModeBeforeStealth ?? currentMode;
    previousOpacityBeforeStealth = previousOpacityBeforeStealth ?? overlayWindow.getOpacity();
    currentMode = "compact";
    resizeOverlayForMode(currentMode);
    overlayWindow.setOpacity(0.72);
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.showInactive();
  } else {
    currentMode = previousModeBeforeStealth ?? currentMode;
    resizeOverlayForMode(currentMode);
    overlayWindow.setOpacity(previousOpacityBeforeStealth ?? 0.9);
    overlayWindow.setIgnoreMouseEvents(isClickThrough, { forward: isClickThrough });
    previousModeBeforeStealth = null;
    previousOpacityBeforeStealth = null;
  }
  sendOverlayData({ type: "stealth_mode", value: enabled });
  sendOverlayData({ type: "mode", value: currentMode });
  mainWindow?.webContents.send("stealth-mode-changed", enabled);
}
function createOverlayWindow() {
  const win = new electron.BrowserWindow({
    width: 380,
    height: 340,
    x: 80,
    y: 80,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: false,
    hasShadow: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path__namespace.join(__dirname, "../preload/index.js"),
      sandbox: true
    }
  });
  if (isDev) {
    win.loadURL(`${VITE_DEV_URL}/overlay.html`);
  } else {
    win.loadFile(rendererPath("overlay.html"));
  }
  return win;
}
function setupSystemAudioLoopback() {
  electron.session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    electron.desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      if (sources.length > 0) {
        callback({
          video: sources[0],
          audio: "loopback"
        });
      }
    });
  });
}
function registerGlobalHotkeys() {
  electron.globalShortcut.register("CommandOrControl+Shift+O", () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        overlayWindow.show();
      }
    }
  });
  electron.globalShortcut.register("CommandOrControl+Shift+T", () => {
    if (overlayWindow) {
      isClickThrough = !isClickThrough;
      if (!stealthMode) {
        overlayWindow.setIgnoreMouseEvents(isClickThrough, { forward: isClickThrough });
      }
    }
  });
  electron.globalShortcut.register("CommandOrControl+Shift+S", () => {
    applyStealthMode(!stealthMode);
  });
  electron.globalShortcut.register("CommandOrControl+Shift+R", () => {
    mainWindow?.webContents.send("toggle-recording");
  });
  electron.globalShortcut.register("CommandOrControl+Shift+Up", () => {
    if (overlayWindow) {
      const current = overlayWindow.getOpacity();
      overlayWindow.setOpacity(Math.min(1, current + 0.1));
    }
  });
  electron.globalShortcut.register("CommandOrControl+Shift+Down", () => {
    if (overlayWindow) {
      const current = overlayWindow.getOpacity();
      overlayWindow.setOpacity(Math.max(0.1, current - 0.1));
    }
  });
  electron.globalShortcut.register("CommandOrControl+Shift+C", () => {
    if (!overlayWindow) return;
    if (stealthMode) return;
    const idx = MODES.indexOf(currentMode);
    currentMode = MODES[(idx + 1) % MODES.length];
    resizeOverlayForMode(currentMode);
    sendOverlayData({
      type: "mode",
      value: currentMode
    });
  });
  electron.globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (!overlayWindow) return;
    const displays = electron.screen.getAllDisplays();
    if (displays.length > 1) {
      const secondary = displays[1];
      overlayWindow.setBounds({
        x: secondary.bounds.x + 50,
        y: secondary.bounds.y + 50,
        width: 400,
        height: 300
      });
    }
  });
}
electron.app.whenReady().then(() => {
  electron.ipcMain.handle("get-overlay-visible", () => overlayWindow?.isVisible() ?? false);
  electron.ipcMain.handle("get-mode", () => currentMode);
  electron.ipcMain.handle("get-stealth-mode", () => stealthMode);
  electron.ipcMain.on("set-overlay-opacity", (_event, opacity) => {
    if (stealthMode) {
      previousOpacityBeforeStealth = Math.max(0.1, Math.min(1, opacity));
      return;
    }
    overlayWindow?.setOpacity(Math.max(0.1, Math.min(1, opacity)));
  });
  electron.ipcMain.on("send-to-overlay", (_event, data) => {
    sendOverlayData(data);
  });
  electron.ipcMain.on("set-mode", (_event, mode) => {
    if (MODES.includes(mode) && overlayWindow && !stealthMode) {
      currentMode = mode;
      resizeOverlayForMode(currentMode);
      sendOverlayData({ type: "mode", value: currentMode });
    }
  });
  electron.ipcMain.on("set-stealth-mode", (_event, enabled) => {
    applyStealthMode(Boolean(enabled));
  });
  setupSystemAudioLoopback();
  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  registerGlobalHotkeys();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
