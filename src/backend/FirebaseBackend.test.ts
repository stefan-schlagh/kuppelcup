import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EventDoc } from "../types";
import { AuthNotice } from "./Backend";

// FirebaseBackend talks to the real Firebase SDK at module load (initializeApp/
// getFirestore/getAuth) and needs `../firebaseConfig`, which is gitignored and
// not present on every checkout. Mock the SDK + config so these stay fast,
// offline unit tests of the *adapter* logic (argument mapping, doc <-> Account/
// EventDoc shaping) — not an integration test against a real project. That is
// what the emulator-backed firestore.rules tests (tests/rules/) are for.
vi.mock("../firebaseConfig", () => ({ firebaseConfig: {} }));
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(() => ({})) }));

const mockAuthInstance: { currentUser: unknown } = { currentUser: null };

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => mockAuthInstance),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailLink: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, path) => ({ __kind: "collection", path })),
  doc: vi.fn((...args: unknown[]) =>
    args.length === 1
      ? { __kind: "doc", id: "generated-id" } // doc(collectionRef) — auto id
      : { __kind: "doc", id: args[2] }, // doc(db, "events", id)
  ),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn((...args: unknown[]) => ({ __kind: "query", args })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ __kind: "where", field, op, value })),
  orderBy: vi.fn((field: string, dir: string) => ({ __kind: "orderBy", field, dir })),
}));

const { FirebaseBackend } = await import("./FirebaseBackend");
const { getDoc, getDocs, setDoc, deleteDoc, onSnapshot } = await import("firebase/firestore");
const {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendSignInLinkToEmail, signInWithEmailLink, isSignInWithEmailLink,
} = await import("firebase/auth");

// FirebaseBackend's email-link flow touches window.location/localStorage/
// history/prompt (no jsdom in this project — the emulator-backed rules
// tests and the e2e suite already cover real-browser behaviour), so stub
// just what it needs, fresh per test.
function makeWindowStub() {
  const store = new Map<string, string>();
  return {
    location: { origin: "https://kuppelcup.example", pathname: "/", href: "https://kuppelcup.example/" },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
    history: { replaceState: vi.fn() },
    prompt: vi.fn(),
  };
}

const sampleEvent: EventDoc = {
  id: "e1",
  name: "Kuppelcup",
  ownerId: "owner-1",
  phase: "anmeldung",
  createdAt: 1000,
  teams: [],
  ko: {},
};

describe("FirebaseBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthInstance.currentUser = null;
    vi.stubGlobal("window", makeWindowStub());
  });

  describe("auth", () => {
    it("has no current account until sign-in", () => {
      const be = new FirebaseBackend();
      expect(be.auth.currentAccount()).toBeNull();
    });

    it("maps the signed-in Firebase user to an Account", () => {
      mockAuthInstance.currentUser = { uid: "u1", displayName: "Alice", email: "a@x.com" };
      const be = new FirebaseBackend();
      expect(be.auth.currentAccount()).toEqual({ id: "u1", name: "Alice" });
    });

    it("falls back to email, then \"Admin\", when displayName is missing", () => {
      mockAuthInstance.currentUser = { uid: "u1", displayName: null, email: "a@x.com" };
      expect(new FirebaseBackend().auth.currentAccount()).toEqual({ id: "u1", name: "a@x.com" });

      mockAuthInstance.currentUser = { uid: "u1", displayName: null, email: null };
      expect(new FirebaseBackend().auth.currentAccount()).toEqual({ id: "u1", name: "Admin" });
    });

    it("signs in with username + password via signInWithEmailAndPassword", async () => {
      vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
        user: { uid: "u1", displayName: "Alice", email: "a@x.com" },
      } as never);
      const be = new FirebaseBackend();
      const acc = await be.auth.signIn("a@x.com", "secret");
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "a@x.com", "secret");
      expect(acc).toEqual({ id: "u1", name: "Alice" });
    });

    it("rejects sign-in with a generic message, not the raw SDK error, and logs the detail", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(new Error("auth/wrong-password: the password is invalid"));
      await expect(new FirebaseBackend().auth.signIn("a@x.com", "bad")).rejects.toThrow(
        "Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.",
      );
      // ...but the real error is still logged, not just swallowed.
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("signIn"),
        expect.objectContaining({ message: expect.stringContaining("auth/wrong-password") }),
      );
      consoleError.mockRestore();
    });

    it("signInWithEmail sends a link and rejects with an AuthNotice (nobody signs in synchronously)", async () => {
      vi.mocked(sendSignInLinkToEmail).mockResolvedValueOnce(undefined as never);
      const err = await new FirebaseBackend().auth.signInWithEmail(" a@x.com ").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AuthNotice);
      expect((err as Error).message).toContain("a@x.com");
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuthInstance,
        "a@x.com", // trimmed
        expect.objectContaining({ url: "https://kuppelcup.example/", handleCodeInApp: true }),
      );
      expect(window.localStorage.getItem("kuppelcup:pendingEmailLinkSignIn")).toBe("a@x.com");
    });

    it("signInWithEmail rejects without calling the SDK for a blank email", async () => {
      await expect(new FirebaseBackend().auth.signInWithEmail("   ")).rejects.toThrow(/e-mail/i);
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    it("completeEmailLinkSignIn is a no-op when the URL isn't a sign-in link", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValueOnce(false);
      await expect(new FirebaseBackend().auth.completeEmailLinkSignIn?.()).resolves.toBeNull();
      expect(signInWithEmailLink).not.toHaveBeenCalled();
    });

    it("completeEmailLinkSignIn completes using the persisted email, then clears it and the URL", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValueOnce(true);
      window.localStorage.setItem("kuppelcup:pendingEmailLinkSignIn", "a@x.com");
      vi.mocked(signInWithEmailLink).mockResolvedValueOnce({ user: { uid: "u1", email: "a@x.com" } } as never);

      const acc = await new FirebaseBackend().auth.completeEmailLinkSignIn?.();
      expect(signInWithEmailLink).toHaveBeenCalledWith(mockAuthInstance, "a@x.com", window.location.href);
      expect(acc).toEqual({ id: "u1", name: "a@x.com" });
      expect(window.localStorage.getItem("kuppelcup:pendingEmailLinkSignIn")).toBeNull();
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/");
    });

    it("completeEmailLinkSignIn falls back to prompting for the email if nothing was persisted", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValueOnce(true);
      vi.mocked(window.prompt).mockReturnValueOnce("prompted@x.com");
      vi.mocked(signInWithEmailLink).mockResolvedValueOnce({ user: { uid: "u2", email: "prompted@x.com" } } as never);

      const acc = await new FirebaseBackend().auth.completeEmailLinkSignIn?.();
      expect(window.prompt).toHaveBeenCalled();
      expect(signInWithEmailLink).toHaveBeenCalledWith(mockAuthInstance, "prompted@x.com", window.location.href);
      expect(acc).toEqual({ id: "u2", name: "prompted@x.com" });
    });

    it("completeEmailLinkSignIn gives up if the email prompt is cancelled", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValueOnce(true);
      vi.mocked(window.prompt).mockReturnValueOnce(null);

      await expect(new FirebaseBackend().auth.completeEmailLinkSignIn?.()).resolves.toBeNull();
      expect(signInWithEmailLink).not.toHaveBeenCalled();
    });

    it("completeEmailLinkSignIn degrades to signed-out (not a thrown error) if the SDK call fails", async () => {
      // This runs during app boot -- throwing here would break loading the
      // app for a stale/expired link, not just fail the sign-in.
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(isSignInWithEmailLink).mockReturnValueOnce(true);
      window.localStorage.setItem("kuppelcup:pendingEmailLinkSignIn", "a@x.com");
      vi.mocked(signInWithEmailLink).mockRejectedValueOnce(new Error("auth/invalid-action-code"));

      await expect(new FirebaseBackend().auth.completeEmailLinkSignIn?.()).resolves.toBeNull();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("creates an account via createUserWithEmailAndPassword, named by username", async () => {
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
        user: { uid: "u2" },
      } as never);
      const acc = await new FirebaseBackend().auth.createAccount("newadmin", "pw");
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "newadmin", "pw");
      expect(acc).toEqual({ id: "u2", name: "newadmin" });
    });

    it("signs out via the SDK", async () => {
      await new FirebaseBackend().auth.signOut();
      expect(signOut).toHaveBeenCalledWith(mockAuthInstance);
    });
  });

  it("has no implicit landing event (Firebase is reached by URL only)", async () => {
    await expect(new FirebaseBackend().landingEvent()).resolves.toBeNull();
  });

  it("lists events owned by the given account, mapped to EventMeta", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ data: () => sampleEvent }],
    } as never);
    const metas = await new FirebaseBackend().listEvents("owner-1");
    expect(metas).toEqual([
      { id: "e1", name: "Kuppelcup", ownerId: "owner-1", phase: "anmeldung", createdAt: 1000 },
    ]);
  });

  it("creates an empty event owned by the caller, in phase 'anmeldung'", async () => {
    const meta = await new FirebaseBackend().createEvent("New Cup", "owner-1");
    expect(meta.id).toBe("generated-id");
    expect(meta).toMatchObject({ name: "New Cup", ownerId: "owner-1", phase: "anmeldung" });
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: "generated-id" }),
      expect.objectContaining({ ...meta, teams: [], ko: {} }),
    );
  });

  it("gets an event by id, or null if it doesn't exist", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => sampleEvent } as never);
    await expect(new FirebaseBackend().getEvent("e1")).resolves.toEqual(sampleEvent);

    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);
    await expect(new FirebaseBackend().getEvent("missing")).resolves.toBeNull();
  });

  it("saves the full event document", async () => {
    await new FirebaseBackend().saveEvent(sampleEvent);
    expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }), sampleEvent);
  });

  it("rejects saveEvent with a generic message on failure, logging the real one", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("permission-denied: Missing or insufficient permissions."));
    await expect(new FirebaseBackend().saveEvent(sampleEvent)).rejects.toThrow(
      "Änderungen konnten nicht gespeichert werden.",
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("saveEvent"),
      expect.objectContaining({ message: expect.stringContaining("permission-denied") }),
    );
    consoleError.mockRestore();
  });

  it("deletes an event by id", async () => {
    await new FirebaseBackend().deleteEvent("e1");
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
  });

  it("subscribes to live changes, mapping snapshots to EventDoc | null", () => {
    let capturedCallback: ((snap: unknown) => void) | undefined;
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation(((_ref: unknown, cb: (snap: unknown) => void) => {
      capturedCallback = cb;
      return unsubscribe;
    }) as never);

    const onChange = vi.fn();
    const returnedUnsubscribe = new FirebaseBackend().subscribeEvent("e1", onChange);
    expect(returnedUnsubscribe).toBe(unsubscribe);

    capturedCallback?.({ exists: () => true, data: () => sampleEvent });
    expect(onChange).toHaveBeenCalledWith(sampleEvent);

    capturedCallback?.({ exists: () => false });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
