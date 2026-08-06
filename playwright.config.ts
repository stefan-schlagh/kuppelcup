import { defineConfig, devices } from "@playwright/test";

// e2e smoke tests against a dev server forced onto LocalBackend
// (VITE_E2E_LOCAL_BACKEND, see src/config.ts) — these must never be able to
// reach the real Firebase project. Run with `npm run test:e2e`; browsers
// need a one-time `npx playwright install chromium`.
const PORT = 5174;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_E2E_LOCAL_BACKEND: "true" },
  },
});
