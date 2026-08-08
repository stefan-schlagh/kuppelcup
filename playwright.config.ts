import { defineConfig, devices } from "@playwright/test";

// e2e smoke tests against a dev server forced onto LocalBackend
// (VITE_E2E_LOCAL_BACKEND, see src/config.ts) — these must never be able to
// reach the real Firebase project. Run with `npm run test:e2e`; browsers
// need a one-time `npx playwright install chromium`.
const PORT = 5174;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Capped rather than the default (one worker per CPU core): several
  // tests now lazy-load @react-pdf/renderer's full browser bundle
  // (~480kB) against a single shared dev server, and full-core parallelism
  // was enough to make otherwise-solid tests time out under contention
  // (verified: --workers=1 was consistently fast and reliable).
  workers: 2,
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
