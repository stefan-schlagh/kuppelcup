import { useState, useMemo, useEffect } from "react";
import { useStorage } from "./hooks/useStorage";
import { useEvents } from "./hooks/useEvents";
import { seedTeams, withRandomResults, randomKoResults, makeTeam, PHASE_LABELS } from "./utils/helpers";
import { sortByStart, rankTeams, selectTop8, buildBracket, buildMonitorQueue, dailyBest } from "./utils/tournament";
import type { Team, EventPhase, KoState } from "./types";
import Bestenliste, { Gemeindewertung, Tagesbestzeit } from "./components/Bestenliste";
import Turnierbaum from "./components/Turnierbaum";
import LiveMonitor from "./components/LiveMonitor";
import AdminPanel from "./components/AdminPanel";
import Urkunden from "./components/Urkunden";
import FullscreenPanel from "./components/FullscreenPanel";

const numberOfParallelRounds = 2

export default function KuppelCup() {
  const {
    account,
    events,
    current,
    loaded,
    saveError,
    dismissSaveError,
    login,
    loginWithEmail,
    createAdmin,
    logout,
    setTeams,
    setKo,
    setPhase,
    patchEvent,
    selectEvent,
    createEvent,
    renameEvent,
    deleteEvent,
  } = useEvents();
  const [tab, setTab] = useState<string>("liste");
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useStorage<"dark" | "light">("kuppelcup:theme", "dark");

  // "Admin" features are unlocked while an admin account is signed in.
  const authed = !!account;

  const runAuth = async (fn: () => Promise<void>) => {
    try {
      setAuthError(null);
      await fn();
      setLoginUser("");
      setLoginPass("");
      setLoginEmail("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  };
  const handleLogin = () => runAuth(() => login(loginUser, loginPass));
  const handleCreateAdmin = () => runAuth(() => createAdmin(loginUser, loginPass));
  const handleEmailLogin = () => runAuth(() => loginWithEmail(loginEmail));

  // Current event's data (empty defaults until an event is loaded/selected).
  const teams: Team[] = current?.teams ?? [];
  const ko: KoState = current?.ko ?? {};
  const phase: EventPhase = current?.phase ?? "anmeldung";
  const competitionName = current?.name ?? "KUPPELCUP";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  

  // --- TOURNAMENT DERIVED STATE (pure logic in utils/tournament.ts) ---
  const scheduledTeams = useMemo(() => sortByStart(teams), [teams]);
  const ranked = useMemo(() => rankTeams(teams), [teams]);
  const top8 = useMemo(() => selectTop8(ranked), [ranked]);
  const bracket = useMemo(() => buildBracket(top8, ko), [top8, ko]);
  const monitorData = useMemo(() => buildMonitorQueue(scheduledTeams, bracket, numberOfParallelRounds), [scheduledTeams, bracket]);
  const dailyBestTimes = useMemo(() => dailyBest(ranked, bracket), [ranked, bracket]);

  const gemeinde = ranked.filter((t) => t.gemeinde);

  // --- EVENT LIFECYCLE + TEAM MANAGEMENT ---
  const locked = phase === "abgeschlossen"; // no changes possible once finished

  const updateRun = (teamId: string, dg: "dg1" | "dg2", field: "zeit" | "strafe", value: number | null) => {
    if (locked) return;
    setTeams(teams.map((t) => (t.id === teamId ? { ...t, [dg]: { ...t[dg], [field]: value } } : t)));
  };

  const updateKoRun = (matchId: string, side: "runA" | "runB", field: "zeit" | "strafe", value: number | null) => {
    if (locked) return;
    const slot = ko[matchId] || {};
    const slotSide = slot[side] || { zeit: null, strafe: 0 };
    setKo({ ...ko, [matchId]: { ...slot, [side]: { ...slotSide, [field]: value } } });
  };

  // Teams can only be added/removed during Anmeldung.
  const addTeam = (name: string) => {
    if (phase !== "anmeldung") return;
    const nextStart = teams.reduce((max, t) => Math.max(max, t.start), 0) + 1;
    setTeams([...teams, makeTeam(name.trim(), nextStart)]);
  };

  const removeTeam = (id: string) => {
    if (phase !== "anmeldung") return;
    setTeams(teams.filter((t) => t.id !== id));
  };

  const loadSampleTeams = () => phase === "anmeldung" && setTeams(seedTeams());

  // Test/showcase helper: fill both the Grunddurchgang and the K.O. phase.
  // Both in one update so the ko write doesn't clobber the new teams.
  const fillRandomResults = () => {
    if (locked) return;
    const withResults = withRandomResults(teams);
    patchEvent({ teams: withResults, ko: randomKoResults(withResults) });
  };

  if (!loaded) return <div className="loading-screen">Lade Daten…</div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-row">
          <div className="hose-icon">⊃⊂</div>
          <h1 className="brand-title">{competitionName}<span className="brand-year">2026</span></h1>
          <div className="header-right">
            {authed && <span className={`phase-badge phase-${phase}`}>{PHASE_LABELS[phase]}</span>}
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Hell/Dunkel wechseln"
              aria-label="Hell/Dunkel wechseln"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
        <nav className="nav-bar">
          {([
            ["liste", "Bestenliste"],
            ["monitor", "Live-Monitor 📺"],
            ["baum", "Turnierbaum"],
            // Urkunden are only for the organiser
            ...(authed ? [["urkunden", "Urkunden 🖨"]] : []),
            ["admin", "Admin"],
          ] as [string, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`nav-btn ${tab === key ? "active" : ""}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {saveError && (
          <div className="save-error-bar" role="alert">
            <span>Speichern fehlgeschlagen: {saveError}</span>
            <button className="save-error-dismiss" onClick={dismissSaveError} aria-label="Schließen">✕</button>
          </div>
        )}
        {tab === "liste" && (
          <FullscreenPanel>
            <Bestenliste ranked={ranked} top8Ids={new Set(top8.map(t => t.id))} />
            <Gemeindewertung ranked={gemeinde} />
            <Tagesbestzeit ranked={dailyBestTimes.slice(0,3)} />
          </FullscreenPanel>
        )}
        {tab === "monitor" && <LiveMonitor data={monitorData} />}
        {tab === "baum" && (
          <FullscreenPanel>
            <Turnierbaum bracket={bracket} editable={false} />
          </FullscreenPanel>
        )}
        {tab === "urkunden" && authed && (
          <Urkunden
            ranked={ranked}
            bracket={bracket}
            competitionName={competitionName}
            year={2026}
          />
        )}
        {tab === "admin" && (
          authed ? (
            <AdminPanel
            teams={scheduledTeams} /* Passes Fixed Starter Sequence directly down to admin rows */
            updateRun={updateRun}
            toggleGastgeber={(id: string) => !locked && setTeams(teams.map(t => t.id === id ? {...t, gastgeber: !t.gastgeber} : t))}
            toggleGemeinde={(id: string) => !locked && setTeams(teams.map(t => t.id === id ? {...t, gemeinde: !t.gemeinde} : t))}
            bracket={bracket}
            updateKoRun={updateKoRun}
            onImportTeams={setTeams}
            phase={phase}
            setPhase={setPhase}
            locked={locked}
            addTeam={addTeam}
            removeTeam={removeTeam}
            loadSampleTeams={loadSampleTeams}
            fillRandomResults={fillRandomResults}
            account={account}
            events={events}
            current={current}
            createEvent={createEvent}
            renameEvent={renameEvent}
            deleteEvent={deleteEvent}
            selectEvent={selectEvent}
            logout={logout}
          />
          ) : (
            <div className="login-box">
              <h2 className="panel-title">Admin-Anmeldung</h2>
              <p className="hint-text">Mit Benutzername und Passwort anmelden oder ein neues Admin-Konto anlegen.</p>
              <input
                type="text"
                value={loginUser}
                placeholder="Benutzername"
                autoComplete="username"
                onChange={(e) => setLoginUser(e.target.value)}
                className="pin-input login-input"
              />
              <input
                type="password"
                value={loginPass}
                placeholder="Passwort"
                autoComplete="current-password"
                onChange={(e) => setLoginPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="pin-input login-input"
              />
              {authError && <p className="pin-error">{authError}</p>}
              <div className="login-actions">
                <button className="pin-btn" onClick={handleLogin}>Anmelden</button>
                <button className="pin-btn login-secondary" onClick={handleCreateAdmin}>Neues Konto erstellen</button>
              </div>

              <div className="login-divider">oder</div>

              <p className="pin-label">Mit E-Mail anmelden</p>
              <input
                type="email"
                value={loginEmail}
                placeholder="E-Mail-Adresse"
                autoComplete="email"
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                className="pin-input login-input"
              />
              <button className="pin-btn login-secondary" onClick={handleEmailLogin}>Link per E-Mail (passwortlos)</button>
            </div>
          ))}
        </main>
      </div>
  );
}