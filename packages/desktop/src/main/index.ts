/**
 * Electron main process.
 *
 * Architecture decisions:
 *   - contextIsolation: true, nodeIntegration: false (security hardened).
 *   - Minimal preload bridge — only exposes what the renderer needs.
 *   - Overlay window: always-on-top, click-through when idle, adjustable opacity.
 *   - System audio loopback via setDisplayMediaRequestHandler with audio: 'loopback'.
 *   - Global hotkeys for quick access without focus-stealing.
 *   - Local orchestrator spawns faster-whisper as a child process and
 *     talks to Ollama over HTTP for fully offline operation.
 */

import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  session,
} from "electron";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

type DisplayMode = "full" | "compact" | "presentation";
let currentMode: DisplayMode = "full";
let previousModeBeforeStealth: DisplayMode | null = null;
let previousOpacityBeforeStealth: number | null = null;
let stealthMode = false;
const MODES: DisplayMode[] = ["full", "compact", "presentation"];

const MODE_SIZES: Record<DisplayMode, { width: number; height: number }> = {
  full: { width: 400, height: 300 },
  compact: { width: 350, height: 44 },
  presentation: { width: 520, height: 400 },
};

const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_URL = "http://localhost:5173";

function rendererPath(...segments: string[]): string {
  if (isDev) {
    return path.join(__dirname, "../renderer", ...segments);
  }
  return path.join(process.resourcesPath, "renderer", ...segments);
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
    },
    title: "Interview Copilot",
    backgroundColor: "#0a0a0f",
    icon: isDev ? undefined : path.join(process.resourcesPath, "icon.ico"),
  });

  if (isDev) {
    win.loadURL(VITE_DEV_URL);
  } else {
    win.loadFile(rendererPath("index.html"));
  }

  return win;
}

let isClickThrough = false;

function resizeOverlayForMode(mode: DisplayMode): void {
  if (!overlayWindow) return;
  const size = MODE_SIZES[mode];
  const bounds = overlayWindow.getBounds();
  overlayWindow.setBounds({ x: bounds.x, y: bounds.y, ...size });
}

function sendOverlayData(data: unknown): void {
  overlayWindow?.webContents.send("overlay-data", data);
}

function applyStealthMode(enabled: boolean): void {
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

function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
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
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL(`${VITE_DEV_URL}/overlay.html`);
  } else {
    win.loadFile(rendererPath("overlay.html"));
  }

  return win;
}

function setupSystemAudioLoopback(): void {
  /**
   * Enable system audio capture for consented calls.
   *
   * Uses Electron's setDisplayMediaRequestHandler with audio: 'loopback'
   * to capture system audio output without needing a virtual audio device.
   * The user must consent via the display media picker.
   */
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      if (sources.length > 0) {
        callback({
          video: sources[0],
          audio: "loopback",
        });
      }
    });
  });
}

function registerGlobalHotkeys(): void {
  // Toggle overlay visibility
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        overlayWindow.show();
      }
    }
  });

  // Toggle click-through on overlay
  globalShortcut.register("CommandOrControl+Shift+T", () => {
    if (overlayWindow) {
      isClickThrough = !isClickThrough;
      if (!stealthMode) {
        overlayWindow.setIgnoreMouseEvents(isClickThrough, { forward: isClickThrough });
      }
    }
  });

  // Toggle stealth mode
  globalShortcut.register("CommandOrControl+Shift+S", () => {
    applyStealthMode(!stealthMode);
  });

  // Toggle recording
  globalShortcut.register("CommandOrControl+Shift+R", () => {
    mainWindow?.webContents.send("toggle-recording");
  });

  // Adjust overlay opacity
  globalShortcut.register("CommandOrControl+Shift+Up", () => {
    if (overlayWindow) {
      const current = overlayWindow.getOpacity();
      overlayWindow.setOpacity(Math.min(1, current + 0.1));
    }
  });

  globalShortcut.register("CommandOrControl+Shift+Down", () => {
    if (overlayWindow) {
      const current = overlayWindow.getOpacity();
      overlayWindow.setOpacity(Math.max(0.1, current - 0.1));
    }
  });

  // Cycle display mode: full → compact → presentation → full
  globalShortcut.register("CommandOrControl+Shift+C", () => {
    if (!overlayWindow) return;
    if (stealthMode) return;
    const idx = MODES.indexOf(currentMode);
    currentMode = MODES[(idx + 1) % MODES.length];

    resizeOverlayForMode(currentMode);

    // Tell the renderer which mode to use
    sendOverlayData({
      type: "mode",
      value: currentMode,
    });
  });

  // Move overlay to second monitor
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (!overlayWindow) return;
    const displays = screen.getAllDisplays();
    if (displays.length > 1) {
      const secondary = displays[1];
      overlayWindow.setBounds({
        x: secondary.bounds.x + 50,
        y: secondary.bounds.y + 50,
        width: 400,
        height: 300,
      });
    }
  });
}

// ── App lifecycle ────────────────────────────────────────────

app.whenReady().then(() => {
  // Register IPC handlers after app is ready (required for electron-vite dev)
  ipcMain.handle("get-overlay-visible", () => overlayWindow?.isVisible() ?? false);
  ipcMain.handle("get-mode", () => currentMode);
  ipcMain.handle("get-stealth-mode", () => stealthMode);

  ipcMain.on("set-overlay-opacity", (_event, opacity: number) => {
    if (stealthMode) {
      previousOpacityBeforeStealth = Math.max(0.1, Math.min(1, opacity));
      return;
    }
    overlayWindow?.setOpacity(Math.max(0.1, Math.min(1, opacity)));
  });

  ipcMain.on("send-to-overlay", (_event, data: unknown) => {
    sendOverlayData(data);
  });

  ipcMain.on("set-mode", (_event, mode: string) => {
    if (MODES.includes(mode as DisplayMode) && overlayWindow && !stealthMode) {
      currentMode = mode as DisplayMode;
      resizeOverlayForMode(currentMode);
      sendOverlayData({ type: "mode", value: currentMode });
    }
  });

  ipcMain.on("set-stealth-mode", (_event, enabled: boolean) => {
    applyStealthMode(Boolean(enabled));
  });

  setupSystemAudioLoopback();
  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  registerGlobalHotkeys();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
