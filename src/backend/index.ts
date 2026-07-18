import type { Backend } from "./Backend";
import { LocalBackend } from "./LocalBackend";

// The active backend the app talks to. Swapped for a Firebase-backed
// implementation once configured (see config.ts / FirebaseBackend).
export const backend: Backend = new LocalBackend();

export type { Backend };
