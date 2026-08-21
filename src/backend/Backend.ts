import type { Account, EventDoc, EventMeta } from "../types";

// A non-error informational message from an auth flow — e.g. "check your
// email for the sign-in link". Thrown (not returned) because the login
// form's only feedback channel is the catch block callers already have,
// but it should be styled/treated as a notice, not a failure.
export class AuthNotice extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthNotice";
  }
}

// The connection layer the app talks to. A LocalBackend implements it with
// localStorage today; a FirebaseBackend maps the same calls onto Firestore
// + Firebase Auth. Everything is async so the Firestore implementation can
// drop in without touching callers.
export interface Backend {
  auth: {
    // The signed-in admin, or null if nobody is signed in yet. Async
    // because FirebaseBackend has to wait for the SDK to finish restoring
    // a persisted session from IndexedDB on a fresh page load -- reading
    // it synchronously right after `getAuth()` returns null even when a
    // session is about to come back.
    currentAccount(): Promise<Account | null>;
    // Sign in with username + password; rejects on bad credentials.
    signIn(username: string, password: string): Promise<Account>;
    // Passwordless sign-in with just an email. LocalBackend signs in (or
    // creates) the matching admin immediately. FirebaseBackend can't sign
    // anyone in synchronously — Firebase email-link requires the user to
    // follow a link emailed to them — so it sends that link and rejects
    // with an AuthNotice instead of resolving an Account.
    signInWithEmail(email: string): Promise<Account>;
    // Create a new (empty) admin account; rejects if the username is taken.
    createAccount(username: string, password: string): Promise<Account>;
    signOut(): Promise<void>;
    // Completes a pending email-link sign-in if the current URL is one
    // (i.e. the user just followed the emailed link back into the app).
    // Call once on startup, before reading currentAccount(). Resolves null
    // if the URL isn't a sign-in link (the common case) or LocalBackend
    // (which never needs this — its signInWithEmail already completes
    // synchronously).
    completeEmailLinkSignIn?(): Promise<Account | null>;
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
