import { readFileSync } from "node:fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

// Runs firestore.rules against the local Firestore emulator (Java required).
// Start it with `npm run test:rules`, which wraps this file in
// `firebase emulators:exec`; it is excluded from the plain `npm test` run
// since it needs the emulator up and reachable.

const PROJECT_ID = "demo-kuppelcup";

let testEnv: RulesTestEnvironment;

type EventOverrides = Partial<{
  id: string;
  name: string;
  ownerId: string;
  phase: string;
  createdAt: number;
  teams: unknown;
  ko: unknown;
}>;

const baseEvent = (overrides: EventOverrides = {}) => ({
  id: "event-1",
  name: "Kuppelcup 2026",
  ownerId: "owner-1",
  phase: "anmeldung",
  createdAt: 1000,
  teams: [],
  ko: {},
  ...overrides,
});

async function seed(docId: string, data: ReturnType<typeof baseEvent>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(collection(ctx.firestore(), "events"), docId), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("firestore.rules: /events/{eventId}", () => {
  describe("get — spectator access by URL (?event=<id>)", () => {
    it("allows a signed-out client to read one event by id", async () => {
      await seed("event-1", baseEvent());
      const unauth = testEnv.unauthenticatedContext();
      await assertSucceeds(getDoc(doc(collection(unauth.firestore(), "events"), "event-1")));
    });

    it("allows any signed-in non-owner to read one event by id", async () => {
      await seed("event-1", baseEvent());
      const other = testEnv.authenticatedContext("someone-else");
      await assertSucceeds(getDoc(doc(collection(other.firestore(), "events"), "event-1")));
    });

    it("resolves to not-found rather than denied for a missing id (no enumeration hint)", async () => {
      const unauth = testEnv.unauthenticatedContext();
      const snap = await assertSucceeds(getDoc(doc(collection(unauth.firestore(), "events"), "missing")));
      expect(snap.exists()).toBe(false);
    });
  });

  describe("list — must not allow dumping the whole collection", () => {
    beforeEach(async () => {
      await seed("owner1-a", baseEvent({ id: "owner1-a", ownerId: "owner-1" }));
      await seed("owner1-b", baseEvent({ id: "owner1-b", ownerId: "owner-1" }));
      await seed("owner2-a", baseEvent({ id: "owner2-a", ownerId: "owner-2" }));
    });

    it("denies an unauthenticated collection query", async () => {
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(getDocs(collection(unauth.firestore(), "events")));
    });

    it("denies an unfiltered query even when signed in", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(getDocs(collection(owner1.firestore(), "events")));
    });

    it("denies querying another owner's events", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        getDocs(query(collection(owner1.firestore(), "events"), where("ownerId", "==", "owner-2"))),
      );
    });

    it("allows an owner to list their own events", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      const snap = await assertSucceeds(
        getDocs(query(collection(owner1.firestore(), "events"), where("ownerId", "==", "owner-1"))),
      );
      expect(snap.docs.map((d) => d.id).sort()).toEqual(["owner1-a", "owner1-b"]);
    });
  });

  describe("create", () => {
    it("denies a signed-out create", async () => {
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(collection(unauth.firestore(), "events"), "event-1"), baseEvent()));
    });

    it("denies creating an event owned by someone else", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(doc(collection(owner1.firestore(), "events"), "event-1"), baseEvent({ ownerId: "owner-2" })),
      );
    });

    it("denies a doc id that doesn't match the embedded id field", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(
          doc(collection(owner1.firestore(), "events"), "mismatched-id"),
          baseEvent({ id: "event-1", ownerId: "owner-1" }),
        ),
      );
    });

    it("denies an invalid phase value", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(
          doc(collection(owner1.firestore(), "events"), "event-1"),
          baseEvent({ ownerId: "owner-1", phase: "not-a-real-phase" }),
        ),
      );
    });

    it("denies a missing/empty name", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(
          doc(collection(owner1.firestore(), "events"), "event-1"),
          baseEvent({ ownerId: "owner-1", name: "" }),
        ),
      );
    });

    it("denies teams/ko with the wrong shape", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(
          doc(collection(owner1.firestore(), "events"), "event-1"),
          baseEvent({ ownerId: "owner-1", teams: "not-a-list" }),
        ),
      );
    });

    it("allows the owner to create a well-formed event", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertSucceeds(
        setDoc(doc(collection(owner1.firestore(), "events"), "event-1"), baseEvent({ ownerId: "owner-1" })),
      );
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await seed("event-1", baseEvent());
    });

    it("denies a non-owner update", async () => {
      const other = testEnv.authenticatedContext("owner-2");
      await assertFails(
        setDoc(doc(collection(other.firestore(), "events"), "event-1"), baseEvent({ name: "Hijacked" })),
      );
    });

    it("denies an unauthenticated update", async () => {
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(
        updateDoc(doc(collection(unauth.firestore(), "events"), "event-1"), { name: "Hijacked" }),
      );
    });

    it("denies transferring ownership via update", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(doc(collection(owner1.firestore(), "events"), "event-1"), baseEvent({ ownerId: "owner-2" })),
      );
    });

    it("denies writing an invalid phase on update", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertFails(
        setDoc(
          doc(collection(owner1.firestore(), "events"), "event-1"),
          baseEvent({ ownerId: "owner-1", phase: "not-a-real-phase" }),
        ),
      );
    });

    it("allows the owner to update their own event", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertSucceeds(
        setDoc(
          doc(collection(owner1.firestore(), "events"), "event-1"),
          baseEvent({ ownerId: "owner-1", phase: "durchfuehrung" }),
        ),
      );
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await seed("event-1", baseEvent());
    });

    it("denies an unauthenticated delete", async () => {
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(deleteDoc(doc(collection(unauth.firestore(), "events"), "event-1")));
    });

    it("denies a non-owner delete", async () => {
      const other = testEnv.authenticatedContext("owner-2");
      await assertFails(deleteDoc(doc(collection(other.firestore(), "events"), "event-1")));
    });

    it("allows the owner to delete their own event", async () => {
      const owner1 = testEnv.authenticatedContext("owner-1");
      await assertSucceeds(deleteDoc(doc(collection(owner1.firestore(), "events"), "event-1")));
    });
  });
});
