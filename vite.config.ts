import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  server: {
    proxy: {
      "/api/planner": { target: "http://127.0.0.1:5180", changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api/planner": { target: "http://127.0.0.1:5180", changeOrigin: true },
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
