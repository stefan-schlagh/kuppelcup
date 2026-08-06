import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts: only picks up the Firestore rules tests,
// with longer timeouts since every assertion is a round trip to the
// emulator. Run via `npm run test:rules` (wraps this in
// `firebase emulators:exec` so the emulator is up for the duration).
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
