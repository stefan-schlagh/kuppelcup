import type { Backend } from "./Backend";
import type { Account, EventDoc, EventMeta } from "../types";
import { firebaseConfig } from "../config";

// Firestore/Auth-backed implementation of the Backend interface.
//
// This is a PREPARED STUB: every method maps 1:1 onto the Firestore/Auth
// call it will make, shown in the comments, but the SDK is not wired up yet
// so the calls throw notConfigured() until activated.
//
// To activate:
//   1. npm install firebase
//   2. fill in firebaseConfig in src/config.ts
//   3. set BACKEND = "firebase" in src/config.ts
//   4. uncomment the SDK wiring below and replace each notConfigured() body
//      with the commented call above it.
//   5. set FIREBASE_WIRED = true in src/config.ts (until then the app stays
//      on LocalBackend, so this stub never runs during frontend-only dev).
//
// Firestore layout: a single "events" collection, one document per event
// keyed by event id, each document holding a full EventDoc. The `ownerId`
// field scopes visibility and drives the security rules
// (allow read/write if request.auth.uid == resource.data.ownerId).

// --- SDK wiring (uncomment once `firebase` is installed) --------------------
// import { initializeApp } from "firebase/app";
// import {
//   getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
//   query, where, orderBy,
// } from "firebase/firestore";
// import {
//   getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
//   sendSignInLinkToEmail, signInWithEmailLink, signOut as fbSignOut,
// } from "firebase/auth";
// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);
// const fbAuth = getAuth(app);
// ---------------------------------------------------------------------------

function notConfigured(): never {
  throw new Error(
    "FirebaseBackend is not configured yet. Install `firebase`, set " +
    "firebaseConfig in src/config.ts, and wire up the SDK calls in " +
    "src/backend/FirebaseBackend.ts.",
  );
}

export class FirebaseBackend implements Backend {
  auth = {
    currentAccount: (): Account | null => {
      // const u = fbAuth.currentUser;
      // return u ? { id: u.uid, name: u.displayName ?? u.email ?? "Admin" } : null;
      void firebaseConfig;
      return null;
    },
    signIn: async (username: string, password: string): Promise<Account> => {
      // const cred = await signInWithEmailAndPassword(fbAuth, username, password);
      // return { id: cred.user.uid, name: cred.user.displayName ?? cred.user.email ?? "Admin" };
      void username;
      void password;
      return notConfigured();
    },
    signInWithEmail: async (email: string): Promise<Account> => {
      // Passwordless email-link sign-in — a two-step flow:
      //   1) await sendSignInLinkToEmail(fbAuth, email, { url: <redirect>, handleCodeInApp: true });
      //      (persist the email locally to complete on return)
      //   2) on the redirect: const cred = await signInWithEmailLink(fbAuth, email, window.location.href);
      //      return { id: cred.user.uid, name: cred.user.email ?? "Admin" };
      void email;
      return notConfigured();
    },
    createAccount: async (username: string, password: string): Promise<Account> => {
      // const cred = await createUserWithEmailAndPassword(fbAuth, username, password);
      // return { id: cred.user.uid, name: username };
      void username;
      void password;
      return notConfigured();
    },
    signOut: async (): Promise<void> => {
      // await fbSignOut(fbAuth);
      return notConfigured();
    },
  };

  async landingEvent(): Promise<EventDoc | null> {
    // No implicit public landing event with Firebase — reach events by URL.
    return null;
  }

  async listEvents(ownerId: string): Promise<EventMeta[]> {
    // const q = query(collection(db, "events"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
    // const snap = await getDocs(q);
    // return snap.docs.map((d) => {
    //   const e = d.data() as EventDoc;
    //   return { id: e.id, name: e.name, ownerId: e.ownerId, phase: e.phase, createdAt: e.createdAt };
    // });
    void ownerId;
    return notConfigured();
  }

  async createEvent(name: string, ownerId: string): Promise<EventMeta> {
    // const ref = doc(collection(db, "events"));
    // const meta = { id: ref.id, name, ownerId, phase: "anmeldung" as const, createdAt: Date.now() };
    // await setDoc(ref, { ...meta, teams: [], ko: {} });
    // return meta;
    void name;
    void ownerId;
    return notConfigured();
  }

  async getEvent(id: string): Promise<EventDoc | null> {
    // const snap = await getDoc(doc(db, "events", id));
    // return snap.exists() ? (snap.data() as EventDoc) : null;
    void id;
    return notConfigured();
  }

  async saveEvent(event: EventDoc): Promise<void> {
    // await setDoc(doc(db, "events", event.id), event);
    void event;
    return notConfigured();
  }

  async deleteEvent(id: string): Promise<void> {
    // await deleteDoc(doc(db, "events", id));
    void id;
    return notConfigured();
  }
}
