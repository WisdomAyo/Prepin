// Ensures ELECTRON_RUN_AS_NODE is not set before launching electron-vite dev.
// When this env var is set, Electron runs as plain Node.js and all APIs are undefined.
delete process.env.ELECTRON_RUN_AS_NODE;

const { execSync } = require("child_process");
execSync("npx electron-vite dev", { stdio: "inherit", env: process.env });
