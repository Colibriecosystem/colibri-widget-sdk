import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` is the one setting that matters to the terminal: a bundled widget is served from
// its own folder, so every emitted asset URL has to be relative. An absolute "/assets/..." would
// resolve against the origin root and 404.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
