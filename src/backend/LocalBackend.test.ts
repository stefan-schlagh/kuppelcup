import { describe, it, expect } from "vitest";
import { LocalBackend, type KeyValueStore } from "./LocalBackend";
import type { EventDoc } from "../types";

function memStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    get: (k) => (m.has(k) ? m.get(k)! : null),
    set: (k, v) => { m.set(k, v); },
    remove: (k) => { m.delete(k); },
  };
}

describe("LocalBackend", () => {
  it("seeds a default admin with a starter event and nobody signed in", async () => {
    const be = new LocalBackend(memStore());
    expect(be.auth.currentAccount()).toBeNull();
    const landing = await be.landingEvent();
    expect(landing?.name).toBe("1. Geissberg KUPPELCUP");
    expect(landing?.ownerId).toBe("local-admin");
  });

  it("signs in with username + password and persists the session (no password leaked)", async () => {
    const be = new LocalBackend(memStore());
    await expect(be.auth.signIn("admin", "wrong")).rejects.toThrow();
    await expect(be.auth.signIn("nobody", "admin")).rejects.toThrow();
    const acc = await be.auth.signIn("admin", "admin");
    expect(acc).toEqual({ id: "local-admin", name: "admin" });
    expect(be.auth.currentAccount()).toEqual({ id: "local-admin", name: "admin" });
    await be.auth.signOut();
    expect(be.auth.currentAccount()).toBeNull();
  });

  it("signs in passwordless by email, creating the admin on first use", async () => {
    const be = new LocalBackend(memStore());
    await expect(be.auth.signInWithEmail("not-an-email")).rejects.toThrow();
    const first = await be.auth.signInWithEmail("chef@ff-buchberg.at");
    expect(first.name).toBe("chef@ff-buchberg.at");
    expect(be.auth.currentAccount()?.id).toBe(first.id);
    // same email signs into the same account (not a duplicate)
    await be.auth.signOut();
    const again = await be.auth.signInWithEmail("Chef@FF-Buchberg.at");
    expect(again.id).toBe(first.id);
  });

  it("creates a new (empty) admin account and rejects duplicate usernames", async () => {
    const be = new LocalBackend(memStore());
    const acc = await be.auth.createAccount("ff-neu", "secret");
    expect(acc.name).toBe("ff-neu");
    expect(await be.listEvents(acc.id)).toEqual([]); // starts with no events
    await expect(be.auth.createAccount("ff-neu", "other")).rejects.toThrow();
    // can sign in with the new credentials
    expect((await be.auth.signIn("ff-neu", "secret")).id).toBe(acc.id);
  });

  it("creates, lists, loads, saves and deletes events scoped by owner", async () => {
    const be = new LocalBackend(memStore());
    const a = await be.createEvent("Cup A", "owner-1");
    const b = await be.createEvent("Cup B", "owner-1");
    await be.createEvent("Other", "owner-2");

    const mine = await be.listEvents("owner-1");
    expect(mine.map((e) => e.name).sort()).toEqual(["Cup A", "Cup B"]);

    const doc = await be.getEvent(a.id);
    expect(doc?.teams).toEqual([]);

    const updated: EventDoc = { ...(doc as EventDoc), phase: "durchfuehrung" };
    await be.saveEvent(updated);
    expect((await be.getEvent(a.id))?.phase).toBe("durchfuehrung");

    await be.deleteEvent(b.id);
    expect((await be.listEvents("owner-1")).map((e) => e.name)).toEqual(["Cup A"]);
  });

  it("migrates legacy single-event keys into an event", async () => {
    const store = memStore();
    store.set(
      "kuppelcup:teams",
      JSON.stringify([{ id: "t1", start: 1, name: "FF X", dg1: { zeit: null, strafe: null }, dg2: { zeit: null, strafe: null } }]),
    );
    store.set("kuppelcup:phase", JSON.stringify("durchfuehrung"));

    const be = new LocalBackend(store, "Legacy Cup");
    const list = await be.listEvents("local-admin");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Legacy Cup");
    expect(list[0].phase).toBe("durchfuehrung");
  });
});
