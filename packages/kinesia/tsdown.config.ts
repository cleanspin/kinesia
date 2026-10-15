import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    core: "src/core/index.ts",
    react: "src/react/index.ts",
  },
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  clean: true,
  publint: true,
  outputOptions: {
    chunkFileNames: "chunks/[hash].js",
    // Hooks only run in client components.
    banner: (chunk) => (chunk.isEntry && chunk.name === "react" ? '"use client";' : ""),
  },
});
