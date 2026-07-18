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
      const doc = await backend.getEvent(list[0].id);
      if (!active) return;
      setEvents(list);
      setCurrent(doc);
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
  }, []);

  const createEvent = useCallback(async (name: string) => {
    if (!account) return;
    const meta = await backend.createEvent(name, account.id);
    setEvents((prev) => [meta, ...prev]);
    setCurrent(await backend.getEvent(meta.id));
  }, [account]);

  const deleteEvent = useCallback(async (id: string) => {
    await backend.deleteEvent(id);
    const rest = events.filter((e) => e.id !== id);
    setEvents(rest);
    if (current?.id === id) {
      setCurrent(rest.length ? await backend.getEvent(rest[0].id) : null);
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
    deleteEvent,
  };
}
