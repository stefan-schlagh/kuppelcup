import type { Backend } from "./Backend";
import type { Account, EventDoc, EventMeta } from "../types";

// A minimal synchronous key/value store. The default wraps localStorage;
// tests inject an in-memory version.
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const browserStore: KeyValueStore = {
  get: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* quota / unavailable */ }
  },
  remove: (k) => {
    try { localStorage.removeItem(k); } catch { /* unavailable */ }
  },
};

const ACCOUNT_KEY = "kuppelcup:account"; // current session (signed-in admin)
const ACCOUNTS_KEY = "kuppelcup:accounts"; // all admin accounts
const EVENTS_KEY = "kuppelcup:events";
const LEGACY_TEAMS = "kuppelcup:teams";
const LEGACY_KO = "kuppelcup:ko";
const LEGACY_PHASE = "kuppelcup:phase";

// Stored account also holds the (local, plaintext — stub only) password and,
// for email-link admins, the email used to sign in.
interface StoredAccount extends Account {
  password: string;
  email?: string;
}

// Built-in default admin. Credentials for local/dev sign-in: admin / admin.
const DEFAULT_ADMIN: StoredAccount = { id: "local-admin", name: "admin", password: "admin" };
const STARTER_EVENT_NAME = "1. Geissberg KUPPELCUP";

const toPublic = (a: StoredAccount): Account => ({ id: a.id, name: a.name });

// localStorage-backed Backend used until Firebase is wired up.
export class LocalBackend implements Backend {
  private store: KeyValueStore;
  private legacyName: string;
  // Per-event live subscribers (same-tab). Cross-tab updates arrive via the
  // window "storage" event registered in subscribeEvent.
  private subscribers = new Map<string, Set<(doc: EventDoc | null) => void>>();

  constructor(store: KeyValueStore = browserStore, legacyName = STARTER_EVENT_NAME) {
    this.store = store;
    this.legacyName = legacyName;
    this.ensureSeeded();
  }

  private readEvents(): EventDoc[] {
    const raw = this.store.get(EVENTS_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) as EventDoc[]; } catch { return []; }
  }

  private writeEvents(events: EventDoc[]): void {
    this.store.set(EVENTS_KEY, JSON.stringify(events));
  }

  private readAccounts(): StoredAccount[] {
    const raw = this.store.get(ACCOUNTS_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) as StoredAccount[]; } catch { return []; }
  }

  private writeAccounts(accounts: StoredAccount[]): void {
    this.store.set(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  // First-run seeding: register the built-in default admin and give it one
  // starter event (unless legacy data is migrated into one). Runs once — later
  // loads and freshly created admins are left untouched (new admins are empty).
  private ensureSeeded(): void {
    const firstRun = !this.store.get(ACCOUNTS_KEY);
    if (firstRun) this.writeAccounts([DEFAULT_ADMIN]);
    this.migrateLegacy();
    if (firstRun && this.readEvents().length === 0) {
      this.writeEvents([
        {
          id: `evt-${Date.now()}`,
          name: STARTER_EVENT_NAME,
          ownerId: DEFAULT_ADMIN.id,
          phase: "anmeldung",
          createdAt: Date.now(),
          teams: [],
          ko: {},
        },
      ]);
    }
  }

  private toMeta(d: EventDoc): EventMeta {
    return { id: d.id, name: d.name, ownerId: d.ownerId, phase: d.phase, createdAt: d.createdAt };
  }

  // One-time import of the old single-event keys into an event document.
  private migrateLegacy(): void {
    if (this.store.get(EVENTS_KEY)) return;
    const teamsRaw = this.store.get(LEGACY_TEAMS);
    if (!teamsRaw) return;
    try {
      const doc: EventDoc = {
        id: `evt-${Date.now()}`,
        name: this.legacyName,
        ownerId: DEFAULT_ADMIN.id,
        phase: JSON.parse(this.store.get(LEGACY_PHASE) ?? '"anmeldung"'),
        createdAt: Date.now(),
        teams: JSON.parse(teamsRaw),
        ko: JSON.parse(this.store.get(LEGACY_KO) ?? "{}"),
      };
      this.writeEvents([doc]);
    } catch { /* ignore malformed legacy data */ }
  }

  auth = {
    currentAccount: (): Account | null => {
      const raw = this.store.get(ACCOUNT_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw) as Account; } catch { return null; }
    },
    // Local placeholder — TODO: replace with Firebase Auth sign-in.
    signIn: async (username: string, password: string): Promise<Account> => {
      const acc = this.readAccounts().find((a) => a.name === username.trim() && a.password === password);
      if (!acc) throw new Error("Falscher Benutzername oder Passwort");
      const pub = toPublic(acc);
      this.store.set(ACCOUNT_KEY, JSON.stringify(pub));
      return pub;
    },
    // Passwordless email sign-in (local stub of Firebase email-link): signs in
    // the admin with this email, creating an empty one on first use.
    signInWithEmail: async (email: string): Promise<Account> => {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@")) throw new Error("Ungültige E-Mail-Adresse");
      const accounts = this.readAccounts();
      let acc = accounts.find((a) => (a.email ?? a.name).toLowerCase() === normalized);
      if (!acc) {
        acc = {
          id: `adm-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: normalized,
          email: normalized,
          password: "",
        };
        this.writeAccounts([...accounts, acc]);
      }
      const pub = toPublic(acc);
      this.store.set(ACCOUNT_KEY, JSON.stringify(pub));
      return pub;
    },
    createAccount: async (username: string, password: string): Promise<Account> => {
      const name = username.trim();
      if (!name) throw new Error("Benutzername fehlt");
      if (!password) throw new Error("Passwort fehlt");
      if (this.readAccounts().some((a) => a.name === name)) {
        throw new Error("Benutzername ist bereits vergeben");
      }
      const acc: StoredAccount = {
        id: `adm-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name,
        password,
      };
      this.writeAccounts([...this.readAccounts(), acc]);
      return toPublic(acc);
    },
    signOut: async (): Promise<void> => {
      this.store.remove(ACCOUNT_KEY);
    },
  };

  async landingEvent(): Promise<EventDoc | null> {
    // The default admin's first event powers the public landing page.
    const mine = this.readEvents()
      .filter((e) => e.ownerId === DEFAULT_ADMIN.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    return mine[0] ?? null;
  }

  async listEvents(ownerId: string): Promise<EventMeta[]> {
    return this.readEvents()
      .filter((e) => e.ownerId === ownerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((e) => this.toMeta(e));
  }

  async createEvent(name: string, ownerId: string): Promise<EventMeta> {
    const doc: EventDoc = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: name.trim() || "Neues Event",
      ownerId,
      phase: "anmeldung",
      createdAt: Date.now(),
      teams: [],
      ko: {},
    };
    this.writeEvents([...this.readEvents(), doc]);
    return this.toMeta(doc);
  }

  async getEvent(id: string): Promise<EventDoc | null> {
    return this.readEvents().find((e) => e.id === id) ?? null;
  }

  async saveEvent(doc: EventDoc): Promise<void> {
    const events = this.readEvents();
    const i = events.findIndex((e) => e.id === doc.id);
    if (i >= 0) events[i] = doc;
    else events.push(doc);
    this.writeEvents(events);
    this.notify(doc.id);
  }

  async deleteEvent(id: string): Promise<void> {
    this.writeEvents(this.readEvents().filter((e) => e.id !== id));
    this.notify(id);
  }

  private notify(id: string): void {
    const doc = this.readEvents().find((e) => e.id === id) ?? null;
    this.subscribers.get(id)?.forEach((cb) => cb(doc));
  }

  subscribeEvent(id: string, onChange: (doc: EventDoc | null) => void): () => void {
    let set = this.subscribers.get(id);
    if (!set) { set = new Set(); this.subscribers.set(id, set); }
    set.add(onChange);

    // Cross-tab: another tab writing to localStorage fires a "storage" event.
    const onStorage = (e: StorageEvent) => {
      if (e.key === EVENTS_KEY) onChange(this.readEvents().find((ev) => ev.id === id) ?? null);
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

    return () => {
      set!.delete(onChange);
      if (set!.size === 0) this.subscribers.delete(id);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }
}
