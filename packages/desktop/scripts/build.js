/**
 * Build script for the Interview Copilot desktop app.
 *
 * Steps:
 * 1. Build the frontend (React + Vite) → packages/frontend/dist/
 * 2. Build Electron main + preload via electron-vite
 * 3. Copy frontend dist into out/renderer/
 * 4. Copy overlay files (already built by electron-vite) into out/renderer/
 * 5. Run electron-builder to produce the executable
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const FRONTEND = path.resolve(ROOT, "packages/frontend");
const DESKTOP = path.resolve(ROOT, "packages/desktop");
const RENDERER_OUT = path.resolve(DESKTOP, "out/renderer");

function run(cmd, cwd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: cwd || DESKTOP });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Step 1: Build frontend
console.log("=== Step 1: Building frontend ===");
run("npx tsc --noEmit && npx vite build", FRONTEND);

// Step 2: Build Electron main + preload
console.log("\n=== Step 2: Building Electron main + preload ===");
run("npx electron-vite build", DESKTOP);

// Step 3: Copy frontend build output to out/renderer
console.log("\n=== Step 3: Copying frontend build to renderer ===");
const frontendDist = path.resolve(FRONTEND, "dist");
if (fs.existsSync(RENDERER_OUT)) {
  fs.rmSync(RENDERER_OUT, { recursive: true });
}
copyDir(frontendDist, RENDERER_OUT);

// Step 4: Copy overlay.html (built by electron-vite or from src)
const overlayHtmlSrc = path.resolve(DESKTOP, "src/renderer/overlay.html");
const overlaySrc = path.resolve(DESKTOP, "src/renderer/overlay.tsx");
if (fs.existsSync(overlayHtmlSrc)) {
  fs.copyFileSync(overlayHtmlSrc, path.resolve(RENDERER_OUT, "overlay.html"));
}
console.log(`Renderer output ready at ${RENDERER_OUT}`);

// Step 5: Package with electron-builder
const args = process.argv.slice(2).join(" ") || "--win";
console.log(`\n=== Step 5: Packaging (${args}) ===`);
run(`npx electron-builder ${args} --config electron-builder.yml`, DESKTOP);

console.log("\n=== Build complete! Check packages/desktop/dist/ ===");
