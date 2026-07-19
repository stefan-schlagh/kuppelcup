import type { Account, EventDoc, EventMeta } from "../types";

// The connection layer the app talks to. A LocalBackend implements it with
// localStorage today; a FirebaseBackend maps the same calls onto Firestore
// + Firebase Auth. Everything is async so the Firestore implementation can
// drop in without touching callers.
export interface Backend {
  auth: {
    // The signed-in admin, or null if nobody is signed in yet.
    currentAccount(): Account | null;
    // Sign in with username + password; rejects on bad credentials.
    signIn(username: string, password: string): Promise<Account>;
    // Passwordless sign-in with just an email (Firebase email-link). Signs in
    // the matching admin, creating an empty one if the email is new.
    signInWithEmail(email: string): Promise<Account>;
    // Create a new (empty) admin account; rejects if the username is taken.
    createAccount(username: string, password: string): Promise<Account>;
    signOut(): Promise<void>;
  };

  // The event to show on the public landing page when nobody is signed in and
  // no ?event=<id> is given (the default admin's first event), or null.
  landingEvent(): Promise<EventDoc | null>;

  // Events owned by the given admin, newest first.
  listEvents(ownerId: string): Promise<EventMeta[]>;
  // Create a new empty event (phase "anmeldung") owned by ownerId.
  createEvent(name: string, ownerId: string): Promise<EventMeta>;
  // Load the full event document (teams + ko), or null if it is gone.
  getEvent(id: string): Promise<EventDoc | null>;
  // Upsert the full event document.
  saveEvent(doc: EventDoc): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  // Subscribe to live changes of one event: calls back with the current doc
  // (or null once it is deleted) whenever it changes, and returns an
  // unsubscribe function. Backed by cross-tab storage events locally and by
  // Firestore onSnapshot once wired.
  subscribeEvent(id: string, onChange: (doc: EventDoc | null) => void): () => void;
}
