import type { Backend } from "./Backend";
import type { Account, EventDoc, EventMeta } from "../types";
import { firebaseConfig } from "../firebaseConfig";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, where, orderBy,
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  /*sendSignInLinkToEmail, signInWithEmailLink,*/ signOut as fbSignOut,
} from "firebase/auth";

// Firestore/Auth-backed implementation of the Backend interface.
//
// Firestore layout: a single "events" collection, one document per event
// keyed by event id, each document holding a full EventDoc. The `ownerId`
// field scopes visibility and drives the security rules (see firestore.rules).

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const fbAuth = getAuth(app);

function notImplemented(): never {
  throw new Error(
    "FirebaseBackend: passwordless email-link sign-in is not implemented yet.",
  );
}

export class FirebaseBackend implements Backend {
  auth = {
    currentAccount: (): Account | null => {
      const u = fbAuth.currentUser;
      return u ? { id: u.uid, name: u.displayName ?? u.email ?? "Admin" } : null;
    },
    signIn: async (username: string, password: string): Promise<Account> => {
      const cred = await signInWithEmailAndPassword(fbAuth, username, password);
      return { id: cred.user.uid, name: cred.user.displayName ?? cred.user.email ?? "Admin" };
    },
    signInWithEmail: async (email: string): Promise<Account> => {
      // Passwordless email-link sign-in — a two-step flow:
      //   1) await sendSignInLinkToEmail(fbAuth, email, { url: <redirect>, handleCodeInApp: true });
      //      (persist the email locally to complete on return)
      //   2) on the redirect: const cred = await signInWithEmailLink(fbAuth, email, window.location.href);
      //      return { id: cred.user.uid, name: cred.user.email ?? "Admin" };
      void email;
      return notImplemented();
    },
    createAccount: async (username: string, password: string): Promise<Account> => {
      const cred = await createUserWithEmailAndPassword(fbAuth, username, password);
      return { id: cred.user.uid, name: username };
    },
    signOut: async (): Promise<void> => {
      await fbSignOut(fbAuth);
    },
  };

  async landingEvent(): Promise<EventDoc | null> {
    // No implicit public landing event with Firebase — reach events by URL.
    return null;
  }

  async listEvents(ownerId: string): Promise<EventMeta[]> {
    const q = query(collection(db, "events"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const e = d.data() as EventDoc;
      return { id: e.id, name: e.name, ownerId: e.ownerId, phase: e.phase, createdAt: e.createdAt };
    });
  }

  async createEvent(name: string, ownerId: string): Promise<EventMeta> {
    const ref = doc(collection(db, "events"));
    const meta = { id: ref.id, name, ownerId, phase: "anmeldung" as const, createdAt: Date.now() };
    await setDoc(ref, { ...meta, teams: [], ko: {} });
    return meta;
  }

  async getEvent(id: string): Promise<EventDoc | null> {
    const snap = await getDoc(doc(db, "events", id));
    return snap.exists() ? (snap.data() as EventDoc) : null;
  }

  async saveEvent(event: EventDoc): Promise<void> {
    await setDoc(doc(db, "events", event.id), event);
  }

  async deleteEvent(id: string): Promise<void> {
    await deleteDoc(doc(db, "events", id));
  }

  subscribeEvent(id: string, onChange: (doc: EventDoc | null) => void): () => void {
    // Real-time via Firestore — this is the whole point of the Firebase backend.
    return onSnapshot(doc(db, "events", id), (snap) =>
      onChange(snap.exists() ? (snap.data() as EventDoc) : null));
  }
}
