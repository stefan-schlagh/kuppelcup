import type { Backend } from "./Backend";
import { LocalBackend } from "./LocalBackend";
import { FirebaseBackend } from "./FirebaseBackend";
import { BACKEND, FIREBASE_WIRED } from "../config";

// The active backend the app talks to, selected via config.ts. "local"
// (default) persists to localStorage; "firebase" uses Firestore/Auth, but
// only once FIREBASE_WIRED is true — otherwise we stay on LocalBackend so
// frontend-only development never hits the unwired stub.
const useFirebase = BACKEND === "firebase" && FIREBASE_WIRED;

export const backend: Backend = useFirebase ? new FirebaseBackend() : new LocalBackend();

export type { Backend };
