import { useState, useEffect, useCallback } from "react";
import { backend } from "../backend";
import type { Account, EventDoc, EventMeta, EventPhase, KoState, Team } from "../types";

const metaOf = (d: EventDoc): EventMeta => ({
  id: d.id,
  name: d.name,
  ownerId: d.ownerId,
  phase: d.phase,
  createdAt: d.createdAt,
});

// Reflect the selected event in the URL (?event=<id>) so it is shareable
// and survives a reload.
const syncUrl = (id: string): void => {
  const url = `${window.location.pathname}?event=${encodeURIComponent(id)}`;
  window.history.replaceState(null, "", url);
};

const requestedEventId = (): string | null =>
  new URLSearchParams(window.location.search).get("event");

// Loads the signed-in admin's events, tracks the selected one, and exposes
// per-event mutators that persist through the backend.
export function useEvents() {
  const [account, setAccount] = useState<Account | null>(null);
  const [events, setEvents] = useState<EventMeta[]>([]);
  const [current, setCurrent] = useState<EventDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const acc = backend.auth.currentAccount() ?? (await backend.auth.signIn());
      if (!active) return;
      setAccount(acc);
      let list = await backend.listEvents(acc.id);
      if (list.length === 0) {
        // Every admin starts with one empty event so the app is usable.
        list = [await backend.createEvent("1. Geissberg KUPPELCUP", acc.id)];
      }
      // A URL like ?event=<id> deep-links to a specific event (which may be
      // shared and not in this admin's own list); otherwise use the first.
      const requested = requestedEventId();
      const doc = (requested && (await backend.getEvent(requested))) || (await backend.getEvent(list[0].id));
      if (!active) return;
      setEvents(list);
      setCurrent(doc);
      if (doc) syncUrl(doc.id);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  const persist = useCallback(async (next: EventDoc) => {
    setCurrent(next);
    setEvents((prev) => prev.map((e) => (e.id === next.id ? metaOf(next) : e)));
    await backend.saveEvent(next);
  }, []);

  const setTeams = useCallback((teams: Team[]) => { if (current) persist({ ...current, teams }); }, [current, persist]);
  const setKo = useCallback((ko: KoState) => { if (current) persist({ ...current, ko }); }, [current, persist]);
  const setPhase = useCallback((phase: EventPhase) => { if (current) persist({ ...current, phase }); }, [current, persist]);

  const selectEvent = useCallback(async (id: string) => {
    setCurrent(await backend.getEvent(id));
    syncUrl(id);
  }, []);

  const createEvent = useCallback(async (name: string) => {
    if (!account) return;
    const meta = await backend.createEvent(name, account.id);
    setEvents((prev) => [meta, ...prev]);
    setCurrent(await backend.getEvent(meta.id));
    syncUrl(meta.id);
  }, [account]);

  const renameEvent = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const doc = id === current?.id ? current : await backend.getEvent(id);
    if (!doc) return;
    const next = { ...doc, name: trimmed };
    if (id === current?.id) setCurrent(next);
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, name: trimmed } : e)));
    await backend.saveEvent(next);
  }, [current]);

  const deleteEvent = useCallback(async (id: string) => {
    await backend.deleteEvent(id);
    const rest = events.filter((e) => e.id !== id);
    setEvents(rest);
    if (current?.id === id) {
      setCurrent(rest.length ? await backend.getEvent(rest[0].id) : null);
      if (rest.length) syncUrl(rest[0].id);
    }
  }, [events, current]);

  return {
    account,
    events,
    current,
    loaded,
    setTeams,
    setKo,
    setPhase,
    selectEvent,
    createEvent,
    renameEvent,
    deleteEvent,
  };
}
