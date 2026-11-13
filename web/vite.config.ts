import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";


export default defineConfig({
  plugins: [react()],
  // Serve fonts and other assets from this origin, as required by the shipped CSP.
  build: { assetsInlineLimit: 0 },
  test: {
    environment: "jsdom",
    globals: true,
    // styles.test.ts reads the stylesheet as text; vitest would otherwise stub every CSS file with an empty string.
    css: { include: /styles\.css/ },
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    setupFiles: "./src/test-setup.ts",
  },
});
