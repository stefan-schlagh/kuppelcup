import { configDefaults, defineConfig } from "vitest/config";

// The Firestore rules tests under tests/rules/ need the Firestore emulator
// (`npm run test:rules`), and e2e/ are Playwright specs that need a browser
// + dev server (`npm run test:e2e`) — both use vitest-shaped *.test.ts /
// *.spec.ts filenames, so keep them out of the plain `npm test` run
// explicitly or vitest would try to collect them too.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/rules/**", "e2e/**"],
  },
});
