// TEMPORARY: enables the test-data buttons in the Admin "Event & Teams"
// tab (load sample teams / generate random results for Grunddurchgang
// AND the K.O. phase). These are only meant for testing and showcases.
// Set to false to hide them.
export const ENABLE_TEST_DATA = true;

export type BackendKind = "local" | "firebase";

// Which backend the app talks to. Stays "local" (localStorage) until
// Firebase is configured; switch to "firebase" to use Firestore/Auth.
export const BACKEND: BackendKind = "firebase";

// Safety toggle for frontend-only development: while false, the app uses
// LocalBackend even if BACKEND is "firebase", so the unwired Firebase stub
// never throws. Flip to true only once FirebaseBackend is actually wired up.
//
// VITE_E2E_LOCAL_BACKEND forces this back to false regardless — set by
// playwright.config.ts so `npm run test:e2e` always runs against
// LocalBackend and can never touch the real Firebase project.
export const FIREBASE_WIRED = import.meta.env.VITE_E2E_LOCAL_BACKEND === "true" ? false : true;
