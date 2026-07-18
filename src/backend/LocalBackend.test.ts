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
  it("signs in a local admin and persists it", async () => {
    const be = new LocalBackend(memStore());
    expect(be.auth.currentAccount()).toBeNull();
    const acc = await be.auth.signIn();
    expect(acc.id).toBe("local-admin");
    expect(be.auth.currentAccount()?.id).toBe("local-admin");
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
