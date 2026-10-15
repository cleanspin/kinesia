import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const source = (path: string) =>
  fileURLToPath(new URL(`../../packages/kinesia/src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Library source, so edits apply without rebuilding it.
    alias: [
      { find: /^kinesia\/core$/, replacement: source("core/index.ts") },
      { find: /^kinesia$/, replacement: source("react/index.ts") },
    ],
  },
});
