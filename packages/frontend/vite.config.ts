import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8765",
      "/ws": {
        target: "http://localhost:8765",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
