// Firebase project config, sourced from Vite env vars (VITE_FIREBASE_*) so
// this file can be tracked in git without committing project-specific
// values. Fill them in locally via .env.local (gitignored) — see
// .env.example for the variable names. `npm run build`/`npm test` still work
// with these unset (CI doesn't need a real Firebase project); only actually
// talking to Firebase requires them.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
