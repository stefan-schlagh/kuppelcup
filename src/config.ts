// TEMPORARY: enables the test-data buttons in the Admin "Event & Teams"
// tab (load sample teams / generate random results for Grunddurchgang
// AND the K.O. phase). These are only meant for testing and showcases.
// Set to false to hide them in a real deploy.
//
// Always on when VITE_FORCE_LOCAL_BACKEND is set (see FIREBASE_WIRED below)
// — that flag already means "this run can't touch the real Firebase
// project" (npm run dev:local, npm run test:e2e), so the e2e suite can rely
// on these buttons without needing the production toggle flipped on too.
export const ENABLE_TEST_DATA = import.meta.env.VITE_FORCE_LOCAL_BACKEND === "true" ? true : false;

export type BackendKind = "local" | "firebase";

// Which backend the app talks to. Stays "local" (localStorage) until
// Firebase is configured; switch to "firebase" to use Firestore/Auth.
export const BACKEND: BackendKind = "firebase";

// Safety toggle for frontend-only development: while false, the app uses
// LocalBackend even if BACKEND is "firebase", so the unwired Firebase stub
// never throws. Flip to true only once FirebaseBackend is actually wired up.
//
// VITE_FORCE_LOCAL_BACKEND forces this back to false regardless — set by
// `npm run dev:local` for your own manual testing against LocalBackend
// (localStorage only, no Firebase project touched at all), and by
// playwright.config.ts so `npm run test:e2e` always runs the same way.
export const FIREBASE_WIRED = import.meta.env.VITE_FORCE_LOCAL_BACKEND === "true" ? false : true;

// The event shown on the public landing page when nobody is signed in and no
// ?event=<id> is given. Deliberately a source constant, not an admin-UI
// setting or Firestore doc: any signed-up admin could otherwise repoint the
// shared public landing page at their own event. Only editing this file (and
// deploying) changes it. null means no event is shown on the bare landing page.
export const DEFAULT_EVENT_ID: string | null = "lOk8zTrHZnU1RGDbsYQQ";
