import type { Account, EventDoc, EventMeta } from "../types";

// The connection layer the app talks to. A LocalBackend implements it with
// localStorage today; a FirebaseBackend maps the same calls onto Firestore
// + Firebase Auth. Everything is async so the Firestore implementation can
// drop in without touching callers.
export interface Backend {
  auth: {
    // The signed-in admin, or null if nobody is signed in yet.
    currentAccount(): Account | null;
    // Sign in and return the admin account (local placeholder for now).
    signIn(): Promise<Account>;
    signOut(): Promise<void>;
  };

  // Events owned by the given admin, newest first.
  listEvents(ownerId: string): Promise<EventMeta[]>;
  // Create a new empty event (phase "anmeldung") owned by ownerId.
  createEvent(name: string, ownerId: string): Promise<EventMeta>;
  // Load the full event document (teams + ko), or null if it is gone.
  getEvent(id: string): Promise<EventDoc | null>;
  // Upsert the full event document.
  saveEvent(doc: EventDoc): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
