import { configDefaults, defineConfig } from "vitest/config";

// The Firestore rules tests under tests/rules/ need the Firestore emulator
// running (`npm run test:rules`), so keep them out of the plain `npm test`
// run — vitest picking them up without an emulator would just hang/fail.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/rules/**"],
  },
});
