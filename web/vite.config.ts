import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";


export default defineConfig({
  plugins: [react()],
  // Serve fonts and other assets from this origin, as required by the shipped CSP.
  build: { assetsInlineLimit: 0 },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test-setup.ts",
  },
});
