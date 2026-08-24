import { useState, useMemo, useEffect } from "react";
import { useStorage } from "./hooks/useStorage";
import { useEvents } from "./hooks/useEvents";
import { AuthNotice } from "./backend";
import { seedTeams, withRandomResults, randomKoResults, makeTeam, reassignStart, PHASE_LABELS } from "./utils/helpers";
import { sortByStart, rankTeams, selectTop8, buildBracket, buildMonitorQueue, dailyBest, gesamtwertung } from "./utils/tournament";
import type { Team, EventPhase, KoState } from "./types";
import Bestenliste, { Gemeindewertung, Tagesbestzeit, Gesamtwertung } from "./components/Bestenliste";
import Turnierbaum from "./components/Turnierbaum";
import LiveMonitor from "./components/LiveMonitor";
import AdminPanel from "./components/AdminPanel";
import Impressum from "./components/Impressum";
import Urkunden from "./components/Urkunden";
import FullscreenPanel from "./components/FullscreenPanel";
import SplitView from "./components/SplitView";
import type { SplitLayout } from "./components/SplitView";
import { Sun, Moon, ListOrdered, TvMinimalPlay, Network, User, ScrollText, Check, Columns2 } from 'lucide-react';

const numberOfParallelRounds = 2

const IMPRESSUM_PATH = "/impressum";

export default function KuppelCup() {
  const {
    account,
    events,
    current,
    loaded,
    saveError,
    dismissSaveError,
    justSaved,
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
    createEventFromImport,
    renameEvent,
    deleteEvent,
  } = useEvents();
  // A direct/bookmarked link to /impressum opens straight into it, on the
  // Admin tab (its only reachable location -- see the nav/tab section below).
  const [showImpressum, setShowImpressum] = useState(() => window.location.pathname === IMPRESSUM_PATH);
  const [tab, setTab] = useState<string>(() => (window.location.pathname === IMPRESSUM_PATH ? "admin" : "liste"));
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [theme, setTheme] = useStorage<"dark" | "light">("kuppelcup:theme", "dark");

  // "Admin" features are unlocked while an admin account is signed in.
  const authed = !!account;

  const openImpressum = () => {
    window.history.replaceState(null, "", IMPRESSUM_PATH);
    setShowImpressum(true);
  };

  // Leaves /impressum for whatever URL the rest of the app would normally
  // show (an open event's ?event=<id>, or the bare root).
  const closeImpressum = () => {
    window.history.replaceState(null, "", current ? `/?event=${encodeURIComponent(current.id)}` : "/");
    setShowImpressum(false);
  };

  const runAuth = async (fn: () => Promise<void>) => {
    try {
      setAuthError(null);
      setAuthNotice(null);
      await fn();
      setLoginUser("");
      setLoginPass("");
      setLoginEmail("");
    } catch (e) {
      if (e instanceof AuthNotice) {
        // Not a failure -- e.g. "check your email for the sign-in link".
        setAuthNotice(e.message);
        setLoginEmail("");
      } else {
        setAuthError(e instanceof Error ? e.message : String(e));
      }
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
  const pdfMeta = { competitionName, year: 2026 };

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
  const gesamt = useMemo(() => gesamtwertung(ranked, bracket), [ranked, bracket]);

  // Bestenliste/Gemeindewertung are standings -- a team with no run yet has
  // nothing to rank, so it's just noise there (still counted everywhere
  // else: team management, Urkunden certificates for all participants, ...).
  const rankedWithResult = useMemo(() => ranked.filter((t) => t.punkte > 0), [ranked]);

  // Gemeindewertung follows the overall standings (K.O. placement for the
  // top 8, base-round rank for the rest), not raw base-round order. Gastgeber
  // teams (außer Konkurrenz) are excluded here too, even if flagged gemeinde.
  const gemeinde = gesamt.filter((t) => t.gemeinde && !t.gastgeber && t.punkte > 0);

  // Split-Ansicht: two of the presentation views side by side on one big
  // screen (e.g. Bestenliste + Live-Monitor when there's only one beamer).
  // The choice per side is persisted, not just session state.
  const [splitLeft, setSplitLeft] = useStorage<string>("kuppelcup:split-left", "liste");
  const [splitRight, setSplitRight] = useStorage<string>("kuppelcup:split-right", "monitor");
  // Side by side by default; stacked ("column") is the better fit for wide
  // content like Turnierbaum's bracket, which can be too cramped at half width.
  const [splitLayout, setSplitLayout] = useStorage<SplitLayout>("kuppelcup:split-layout", "row");
  const splitOptions = [
    {
      key: "liste", label: "Bestenliste", render: () => (
        <>
          <Bestenliste ranked={rankedWithResult} top8Ids={new Set(top8.map(t => t.id))} />
          <Gemeindewertung ranked={gemeinde} />
          <Tagesbestzeit ranked={dailyBestTimes.slice(0, 3)} />
          <Gesamtwertung ranked={gesamt} />
        </>
      ),
    },
    { key: "monitor", label: "Live-Monitor", render: () => <LiveMonitor data={monitorData} /> },
    { key: "baum", label: "Turnierbaum", render: () => <Turnierbaum bracket={bracket} editable={false} /> },
  ];

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

  // Renaming is only meaningful while teams are still being registered.
  // Only guard against a fully blank name here -- don't trim the live value,
  // or a trailing space the user just typed (e.g. to turn "example" into
  // "example 2") gets stripped before they can type the next character.
  const renameTeam = (id: string, name: string) => {
    if (phase !== "anmeldung") return;
    if (!name.trim()) return;
    setTeams(teams.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  // Unlike name/roster changes, the start number may need correcting even
  // after registration has closed (e.g. a running-order mistake). Colliding
  // with another team's number shifts everyone in between instead of
  // creating a duplicate -- see reassignStart.
  const updateTeamStart = (id: string, start: number) => {
    if (locked) return;
    setTeams(reassignStart(teams, id, start));
  };

  // Swaps a team with its immediate neighbour in start order -- the
  // intuitive "one step up/down the list" move, as opposed to typing an
  // arbitrary target number (updateTeamStart).
  const moveTeamStart = (id: string, direction: -1 | 1) => {
    if (locked) return;
    const idx = scheduledTeams.findIndex((t) => t.id === id);
    const neighbor = scheduledTeams[idx + direction];
    if (idx === -1 || !neighbor) return;
    setTeams(reassignStart(teams, id, neighbor.start));
  };
  const moveTeamUp = (id: string) => moveTeamStart(id, -1);
  const moveTeamDown = (id: string) => moveTeamStart(id, 1);

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
            {authed && (
              <span className={`saved-flash ${justSaved ? "is-visible" : ""}`} aria-live="polite">
                <Check size={14} /> Gespeichert
              </span>
            )}
            {authed && <span className={`phase-badge phase-${phase}`}>{PHASE_LABELS[phase]}</span>}
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Hell/Dunkel wechseln"
              aria-label="Hell/Dunkel wechseln"
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
          </div>
        </div>
        <nav className="nav-bar">
          {([
            ["liste", "Bestenliste", <ListOrdered />],
            ["monitor", "Live-Monitor", <TvMinimalPlay />],
            ["baum", "Turnierbaum", <Network />],
            ["split", "Split-Ansicht", <Columns2 />],
            // Urkunden are only for the organiser
            ...(authed ? [["urkunden", "Urkunden", <ScrollText />]] : []),
            ["admin", "Admin", <User />],
          ] as [string, string, React.ReactNode][]).map(([key, label, icon]) => (
            <button
              key={key}
              data-tab={key}
              onClick={() => { if (showImpressum) closeImpressum(); setTab(key); }}
              className={`nav-btn ${tab === key ? "active" : ""}`}
            >
              {icon && <span className="nav-icon">{icon}</span>}
              {label && <span className="nav-label">{label}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {saveError && (
          <div className="save-error-bar" role="alert">
            <span>{saveError}</span>
            <button className="save-error-dismiss" onClick={dismissSaveError} aria-label="Schließen">✕</button>
          </div>
        )}
        {tab === "liste" && (
          <FullscreenPanel>
            <Bestenliste ranked={rankedWithResult} top8Ids={new Set(top8.map(t => t.id))} />
            <Gemeindewertung ranked={gemeinde} />
            <Tagesbestzeit ranked={dailyBestTimes.slice(0,3)} />
            <Gesamtwertung ranked={gesamt} />
          </FullscreenPanel>
        )}
        {tab === "monitor" && (
          <FullscreenPanel>
            <LiveMonitor data={monitorData} />
          </FullscreenPanel>
        )}
        {tab === "baum" && (
          <FullscreenPanel>
            <Turnierbaum bracket={bracket} editable={false} />
          </FullscreenPanel>
        )}
        {tab === "split" && (
          <div className="split-tab">
            <p className="split-too-small hint-text">
              Die Split-Ansicht ist für große Bildschirme gedacht und auf kleinen nicht verfügbar.
            </p>
            <FullscreenPanel>
              <SplitView
                options={splitOptions}
                left={splitLeft}
                right={splitRight}
                onLeftChange={setSplitLeft}
                onRightChange={setSplitRight}
                layout={splitLayout}
                onLayoutChange={setSplitLayout}
              />
            </FullscreenPanel>
          </div>
        )}
        {tab === "urkunden" && authed && (
          <Urkunden
            gesamt={gesamt}
            bracket={bracket}
            competitionName={competitionName}
            year={2026}
          />
        )}
        {tab === "admin" && (
          showImpressum ? (
            <Impressum onBack={closeImpressum} />
          ) : authed ? (
            <>
            <AdminPanel
            teams={scheduledTeams} /* Passes Fixed Starter Sequence directly down to admin rows */
            updateRun={updateRun}
            toggleGastgeber={(id: string) => !locked && setTeams(teams.map(t => t.id === id ? {...t, gastgeber: !t.gastgeber} : t))}
            toggleGemeinde={(id: string) => !locked && setTeams(teams.map(t => t.id === id ? {...t, gemeinde: !t.gemeinde} : t))}
            bracket={bracket}
            ko={ko}
            updateKoRun={updateKoRun}
            onImportBackup={patchEvent}
            onImportAsNewEvent={createEventFromImport}
            phase={phase}
            setPhase={setPhase}
            locked={locked}
            addTeam={addTeam}
            removeTeam={removeTeam}
            renameTeam={renameTeam}
            updateTeamStart={updateTeamStart}
            moveTeamUp={moveTeamUp}
            moveTeamDown={moveTeamDown}
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
            ranked={rankedWithResult}
            top8Ids={new Set(top8.map(t => t.id))}
            gemeinde={gemeinde}
            dailyBestTimes={dailyBestTimes}
            gesamt={gesamt}
            pdfMeta={pdfMeta}
          />
            <button className="app-footer-link" onClick={openImpressum}>Impressum</button>
            </>
          ) : (
            <>
            <div className="login-box">
              <h2 className="panel-title">Admin-Anmeldung</h2>
              <p className="hint-text">Mit E-Mail und Passwort anmelden oder ein neues Admin-Konto anlegen.</p>
              <input
                type="email"
                value={loginUser}
                placeholder="E-Mail-Adresse"
                autoComplete="email"
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
              {authNotice && <p className="pin-notice">{authNotice}</p>}
            </div>
            <button className="app-footer-link" onClick={openImpressum}>Impressum</button>
            </>
          ))}
        </main>
      </div>
  );
}