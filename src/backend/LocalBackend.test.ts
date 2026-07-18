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
    const accounts = await be.auth.listAccounts();
    expect(accounts.map((a) => a.id)).toEqual(["local-admin"]);
    const landing = await be.landingEvent();
    expect(landing?.name).toBe("1. Geissberg KUPPELCUP");
    expect(landing?.ownerId).toBe("local-admin");
  });

  it("signs in as an existing admin and persists the session", async () => {
    const be = new LocalBackend(memStore());
    await expect(be.auth.signIn("nope")).rejects.toThrow();
    const acc = await be.auth.signIn("local-admin");
    expect(acc.name).toBe("Admin");
    expect(be.auth.currentAccount()?.id).toBe("local-admin");
    await be.auth.signOut();
    expect(be.auth.currentAccount()).toBeNull();
  });

  it("creates a new (empty) admin account", async () => {
    const be = new LocalBackend(memStore());
    const acc = await be.auth.createAccount("FF Neu");
    expect(acc.name).toBe("FF Neu");
    expect((await be.auth.listAccounts()).map((a) => a.name)).toEqual(["Admin", "FF Neu"]);
    expect(await be.listEvents(acc.id)).toEqual([]); // starts with no events
    const signed = await be.auth.signIn(acc.id);
    expect(signed.id).toBe(acc.id);
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
