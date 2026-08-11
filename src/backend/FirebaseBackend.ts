import type { Backend } from "./Backend";
import { AuthNotice } from "./Backend";
import type { Account, EventDoc, EventMeta } from "../types";
import { firebaseConfig } from "../firebaseConfig";
import { reportError } from "../sentry";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, where, orderBy,
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendSignInLinkToEmail, signInWithEmailLink, isSignInWithEmailLink,
  signOut as fbSignOut,
} from "firebase/auth";

// Firestore/Auth-backed implementation of the Backend interface.
//
// Firestore layout: a single "events" collection, one document per event
// keyed by event id, each document holding a full EventDoc. The `ownerId`
// field scopes visibility and drives the security rules (see firestore.rules).
//
// SDK setup lives on the instance (constructor), not the module scope.
// `backend/index.ts` statically imports this file regardless of which
// backend is actually selected -- a module-level `getAuth()`/`getFirestore()`
// would run on every boot even when LocalBackend is what's actually used,
// and both throw synchronously with an invalid/missing config (e.g. no
// VITE_FIREBASE_* env vars — CI, or e2e's LocalBackend-only dev server),
// crashing the whole app before React even renders.

// Email-link sign-in is a two-step, cross-page-load flow: request the link
// (below), then complete it when the user comes back via that link
// (FirebaseBackend.auth.completeEmailLinkSignIn). The email has to survive
// that round trip somewhere the second load can read it back from.
const PENDING_EMAIL_KEY = "kuppelcup:pendingEmailLinkSignIn";

// Firebase SDK errors (auth/invalid-email, permission-denied, network
// blips, ...) carry internal detail that isn't safe or useful to show an
// end user. Report the real error here, at the source (console always;
// Sentry too when configured — see ../sentry), and surface only a generic,
// already-display-ready message to the UI.
async function logged<T>(context: string, genericMessage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[FirebaseBackend] ${context}:`, e);
    reportError(`FirebaseBackend.${context}`, e);
    throw new Error(genericMessage);
  }
}

export class FirebaseBackend implements Backend {
  private app = initializeApp(firebaseConfig);
  private db = getFirestore(this.app);
  private fbAuth = getAuth(this.app);

  auth = {
    currentAccount: (): Account | null => {
      const u = this.fbAuth.currentUser;
      return u ? { id: u.uid, name: u.displayName ?? u.email ?? "Admin" } : null;
    },
    signIn: async (username: string, password: string): Promise<Account> =>
      logged("signIn", "Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.", async () => {
        const cred = await signInWithEmailAndPassword(this.fbAuth, username, password);
        return { id: cred.user.uid, name: cred.user.displayName ?? cred.user.email ?? "Admin" };
      }),
    signInWithEmail: async (email: string): Promise<Account> => {
      const trimmed = email.trim();
      if (!trimmed) throw new Error("E-Mail-Adresse fehlt.");
      // No account is signed in yet -- that only happens once the user
      // follows the emailed link back into the app (completeEmailLinkSignIn).
      await logged("signInWithEmail", "Anmeldelink konnte nicht gesendet werden. Bitte versuchen Sie es erneut.", () =>
        sendSignInLinkToEmail(this.fbAuth, trimmed, {
          url: window.location.origin + window.location.pathname,
          handleCodeInApp: true,
        }),
      );
      window.localStorage.setItem(PENDING_EMAIL_KEY, trimmed);
      throw new AuthNotice(`Anmeldelink an ${trimmed} gesendet — bitte E-Mails prüfen.`);
    },
    createAccount: async (username: string, password: string): Promise<Account> =>
      logged("createAccount", "Konto konnte nicht erstellt werden. Bitte versuchen Sie es erneut.", async () => {
        const cred = await createUserWithEmailAndPassword(this.fbAuth, username, password);
        return { id: cred.user.uid, name: username };
      }),
    signOut: async (): Promise<void> =>
      logged("signOut", "Abmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.", () => fbSignOut(this.fbAuth)),
    completeEmailLinkSignIn: async (): Promise<Account | null> => {
      if (!isSignInWithEmailLink(this.fbAuth, window.location.href)) return null;
      const email = window.localStorage.getItem(PENDING_EMAIL_KEY)
        ?? window.prompt("Zur Bestätigung bitte die E-Mail-Adresse erneut eingeben:");
      if (!email) return null;
      try {
        const cred = await signInWithEmailLink(this.fbAuth, email, window.location.href);
        window.localStorage.removeItem(PENDING_EMAIL_KEY);
        // Drop Firebase's sign-in params (apiKey/oobCode/mode/...) so a reload
        // doesn't try to replay the same link.
        window.history.replaceState(null, "", window.location.pathname);
        return { id: cred.user.uid, name: cred.user.email ?? "Admin" };
      } catch (e) {
        // Runs during app boot (useEvents' init effect) -- throwing here
        // would break loading the app for anyone with a stale/expired link,
        // not just fail the sign-in. Log and degrade to signed-out instead.
        console.error("[FirebaseBackend] completeEmailLinkSignIn:", e);
        reportError("FirebaseBackend.completeEmailLinkSignIn", e);
        return null;
      }
    },
  };

  async landingEvent(): Promise<EventDoc | null> {
    // No implicit public landing event with Firebase — reach events by URL.
    return null;
  }

  async listEvents(ownerId: string): Promise<EventMeta[]> {
    return logged("listEvents", "Events konnten nicht geladen werden.", async () => {
      const q = query(collection(this.db, "events"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const e = d.data() as EventDoc;
        return { id: e.id, name: e.name, ownerId: e.ownerId, phase: e.phase, createdAt: e.createdAt };
      });
    });
  }

  async createEvent(name: string, ownerId: string): Promise<EventMeta> {
    return logged("createEvent", "Event konnte nicht erstellt werden.", async () => {
      const ref = doc(collection(this.db, "events"));
      const meta = { id: ref.id, name, ownerId, phase: "anmeldung" as const, createdAt: Date.now() };
      await setDoc(ref, { ...meta, teams: [], ko: {} });
      return meta;
    });
  }

  async getEvent(id: string): Promise<EventDoc | null> {
    return logged("getEvent", "Event konnte nicht geladen werden.", async () => {
      const snap = await getDoc(doc(this.db, "events", id));
      return snap.exists() ? (snap.data() as EventDoc) : null;
    });
  }

  async saveEvent(event: EventDoc): Promise<void> {
    return logged("saveEvent", "Änderungen konnten nicht gespeichert werden.", () =>
      setDoc(doc(this.db, "events", event.id), event));
  }

  async deleteEvent(id: string): Promise<void> {
    return logged("deleteEvent", "Event konnte nicht gelöscht werden.", () =>
      deleteDoc(doc(this.db, "events", id)));
  }

  subscribeEvent(id: string, onChange: (doc: EventDoc | null) => void): () => void {
    // Real-time via Firestore — this is the whole point of the Firebase backend.
    return onSnapshot(
      doc(this.db, "events", id),
      (snap) => onChange(snap.exists() ? (snap.data() as EventDoc) : null),
      (err) => {
        console.error(`[FirebaseBackend] subscribeEvent(${id}):`, err);
        reportError("FirebaseBackend.subscribeEvent", err);
      },
    );
  }
}
