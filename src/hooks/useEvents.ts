import { useState, useEffect, useCallback, useRef } from "react";
import { backend } from "../backend";
import type { Account, EventDoc, EventMeta, EventPhase, KoState, Team } from "../types";

// Frequent edits are persisted on this debounce rather than per keystroke.
const SAVE_DEBOUNCE_MS = 400;

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

const clearUrl = (): void => {
  window.history.replaceState(null, "", window.location.pathname);
};

// Loads the signed-in admin's events, tracks the selected one, and exposes
// per-event mutators that persist through the backend.
export function useEvents() {
  const [account, setAccount] = useState<Account | null>(null);
  const [events, setEvents] = useState<EventMeta[]>([]);
  const [current, setCurrent] = useState<EventDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<EventDoc | null>(null);
  const selfWriting = useRef(false); // true while our own write is in flight

  useEffect(() => {
    // Run exactly once. A ref guard (not a per-effect cancel flag) is used so
    // React StrictMode's double-invoke — and the interleaved async that would
    // let two passes both find an empty list — can't create duplicate events.
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      const acc = backend.auth.currentAccount(); // persisted session, or null
      setAccount(acc);
      const list = acc ? await backend.listEvents(acc.id) : [];
      setEvents(list);

      // A URL like ?event=<id> deep-links to a specific event (which may be
      // shared and not owned by this admin). Otherwise fall back to the
      // signed-in admin's first event, or the public landing event.
      const requested = requestedEventId();
      let doc = requested ? await backend.getEvent(requested) : null;
      if (!doc) {
        doc = acc
          ? (list[0] ? await backend.getEvent(list[0].id) : null)
          : await backend.landingEvent();
      }
      setCurrent(doc);
      if (doc) syncUrl(doc.id);
      setLoaded(true);
    })();
  }, []);

  const saveNow = useCallback(async (doc: EventDoc) => {
    selfWriting.current = true;
    try {
      await backend.saveEvent(doc);
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      selfWriting.current = false;
    }
  }, []);

  // Discard any pending debounced write (used when the doc is about to be
  // deleted or fully replaced by an immediate write).
  const cancelPending = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    pending.current = null;
  }, []);

  // Persist any pending debounced write immediately (used before switching
  // events and on unmount / tab hide).
  const flush = useCallback(() => {
    const doc = pending.current;
    cancelPending();
    if (doc) void saveNow(doc);
  }, [cancelPending, saveNow]);

  // Frequent edits (result entry) update local state immediately and persist
  // on a short debounce, so we don't write the whole document on every keystroke.
  const applyLocal = useCallback((next: EventDoc) => {
    setCurrent(next);
    setEvents((prev) => prev.map((e) => (e.id === next.id ? metaOf(next) : e)));
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const doc = pending.current;
      pending.current = null;
      if (doc) void saveNow(doc);
    }, SAVE_DEBOUNCE_MS);
  }, [saveNow]);

  // Flush a pending write when the tab is hidden or the hook unmounts.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  // Live updates: reflect changes to the current event made elsewhere (other
  // tabs now, other clients once Firebase is wired). Our own writes are skipped
  // via selfWriting, and incoming updates are ignored while we have unsaved
  // local edits so a remote snapshot can't stomp in-progress entry.
  useEffect(() => {
    const id = current?.id;
    if (!id) return;
    return backend.subscribeEvent(id, (doc) => {
      if (selfWriting.current || pending.current?.id === id) return;
      if (!doc) {
        setCurrent((c) => (c?.id === id ? null : c));
        return;
      }
      setCurrent((c) => (c && c.id === id ? doc : c));
      setEvents((prev) => prev.map((e) => (e.id === id ? metaOf(doc) : e)));
    });
  }, [current?.id]);

  // Apply several fields at once so callers that change more than one part of
  // the event (e.g. teams + ko together) don't clobber each other via stale state.
  const patchEvent = useCallback((partial: Partial<EventDoc>) => { if (current) applyLocal({ ...current, ...partial }); }, [current, applyLocal]);

  const setTeams = useCallback((teams: Team[]) => { if (current) applyLocal({ ...current, teams }); }, [current, applyLocal]);
  const setKo = useCallback((ko: KoState) => { if (current) applyLocal({ ...current, ko }); }, [current, applyLocal]);
  const setPhase = useCallback((phase: EventPhase) => { if (current) applyLocal({ ...current, phase }); }, [current, applyLocal]);

  const selectEvent = useCallback(async (id: string) => {
    flush();
    setCurrent(await backend.getEvent(id));
    syncUrl(id);
  }, [flush]);

  const createEvent = useCallback(async (name: string) => {
    if (!account) return;
    flush();
    const meta = await backend.createEvent(name, account.id);
    setEvents((prev) => [meta, ...prev]);
    setCurrent(await backend.getEvent(meta.id));
    syncUrl(meta.id);
  }, [account, flush]);

  const renameEvent = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (id === current?.id) {
      // Renaming the current event: fold in any un-flushed edits and write now,
      // dropping the stale pending save so it can't overwrite the new name.
      const next = { ...current, name: trimmed };
      cancelPending();
      setCurrent(next);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, name: trimmed } : e)));
      await saveNow(next);
    } else {
      const doc = await backend.getEvent(id);
      if (!doc) return;
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, name: trimmed } : e)));
      await saveNow({ ...doc, name: trimmed });
    }
  }, [current, cancelPending, saveNow]);

  const deleteEvent = useCallback(async (id: string) => {
    // Drop a pending write for this event so a late save can't resurrect it.
    if (pending.current?.id === id) cancelPending();
    else flush();
    selfWriting.current = true;
    try {
      await backend.deleteEvent(id);
    } finally {
      selfWriting.current = false;
    }
    const rest = events.filter((e) => e.id !== id);
    setEvents(rest);
    if (current?.id === id) {
      setCurrent(rest.length ? await backend.getEvent(rest[0].id) : null);
      if (rest.length) syncUrl(rest[0].id);
    }
  }, [events, current, cancelPending, flush]);

  // --- ADMIN ACCOUNTS --- (login/create reject on error; caller surfaces it)
  const enterAccount = useCallback(async (acc: Account) => {
    setAccount(acc);
    const list = await backend.listEvents(acc.id);
    setEvents(list);
    const doc = list[0] ? await backend.getEvent(list[0].id) : null;
    setCurrent(doc);
    if (doc) syncUrl(doc.id);
    else clearUrl();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await enterAccount(await backend.auth.signIn(username, password));
  }, [enterAccount]);

  const loginWithEmail = useCallback(async (email: string) => {
    await enterAccount(await backend.auth.signInWithEmail(email));
  }, [enterAccount]);

  const createAdmin = useCallback(async (username: string, password: string) => {
    const acc = await backend.auth.createAccount(username, password);
    await backend.auth.signIn(username, password);
    await enterAccount(acc); // a new admin starts empty
  }, [enterAccount]);

  const logout = useCallback(async () => {
    flush();
    await backend.auth.signOut();
    setAccount(null);
    setEvents([]);
    const doc = await backend.landingEvent();
    setCurrent(doc);
    if (doc) syncUrl(doc.id);
    else clearUrl();
  }, [flush]);

  return {
    account,
    events,
    current,
    loaded,
    saveError,
    dismissSaveError: () => setSaveError(null),
    login,
    loginWithEmail,
    createAdmin,
    logout,
    patchEvent,
    setTeams,
    setKo,
    setPhase,
    selectEvent,
    createEvent,
    renameEvent,
    deleteEvent,
  };
}
