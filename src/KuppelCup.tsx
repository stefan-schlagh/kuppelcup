import { useState, useMemo, useEffect } from "react";
import { useStorage } from "./hooks/useStorage";
import { useEvents } from "./hooks/useEvents";
import { seedTeams, gesamt, punkte, SEED_ORDER, withRandomResults, randomKoResults, makeTeam, PHASE_LABELS, byPunkte } from "./utils/helpers";
import type { Team, BracketData, EventPhase, KoState } from "./types";
import Bestenliste, { Gemeindewertung, Tagesbestzeit } from "./components/Bestenliste";
import Turnierbaum from "./components/Turnierbaum";
import LiveMonitor from "./components/LiveMonitor";
import AdminPanel from "./components/AdminPanel";
import Urkunden from "./components/Urkunden";

const numberOfParallelRounds = 2

export default function KuppelCup() {
  const {
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
  } = useEvents();
  const [tab, setTab] = useState<string>("liste");
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [theme, setTheme] = useStorage<"dark" | "light">("kuppelcup:theme", "dark");
  const ADMIN_PIN = "2024";

  // Current event's data (empty defaults until an event is loaded/selected).
  const teams: Team[] = current?.teams ?? [];
  const ko: KoState = current?.ko ?? {};
  const phase: EventPhase = current?.phase ?? "anmeldung";
  const competitionName = current?.name ?? "KUPPELCUP";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  

  // --- a) FIXED ORDER FOR BASE ROUNDS ---
  // Sorted strictly by starting number (Startreihenfolge)
  const scheduledTeams = useMemo(() => {
    return [...teams].sort((a, b) => a.start - b.start);
  }, [teams]);

  // --- b) LIVE MONITOR VIEW ENGINE ---
  // Determine which team is up based on missing times in DG1 then DG2
  const monitorData = useMemo(() => {
    const queue: { team: Team; round: "dg1" | "dg2" }[] = [];
    // Add all DG1 runs, then all DG2 runs in their fixed order
    scheduledTeams.forEach(t => queue.push({ team: t, round: "dg1" }));
    scheduledTeams.forEach(t => queue.push({ team: t, round: "dg2" }));

    // Find the first runner profile that lacks a tracked running time
    const currentIndex = queue.findIndex(q => q.team[q.round].zeit === null);

    // Everything finished -> no current/next, former = last chunk that ran
    if (currentIndex === -1) {
      const lastChunkStart = Math.max(0, queue.length - numberOfParallelRounds);
      return {
        former: queue.length > 0 ? queue.slice(lastChunkStart) : [],
        current: [],
        next: [],
      };
    }

    // Align chunk boundaries to numberOfParallelRounds, based on currentIndex
    const chunkIndex = Math.floor(currentIndex / numberOfParallelRounds);
    const currentStart = chunkIndex * numberOfParallelRounds;
    const currentEnd = currentStart + numberOfParallelRounds;
    const formerStart = currentStart - numberOfParallelRounds;
    const nextStart = currentEnd;
    const nextEnd = nextStart + numberOfParallelRounds;

    return {
      former: formerStart >= 0 ? queue.slice(formerStart, currentStart) : [],
      current: queue.slice(currentStart, currentEnd),
      next: nextStart < queue.length ? queue.slice(nextStart, nextEnd) : [],
    };
  }, [scheduledTeams, numberOfParallelRounds]);

  // Calculations for KO Brackets (unchanged from last iteration)...
  const ranked = useMemo(() => {
    return [...teams]
      .map((t) => ({
        ...t,
        g1: gesamt(t.dg1),
        g2: gesamt(t.dg2),
        punkte: punkte(t),
      }))
      .sort(byPunkte);
  }, [teams]);

  const eligible = ranked.filter((t) => (!t.gastgeber && punkte(t as any) !== 0));
  const top8 = eligible.slice(0, 8);
  const bracket = useMemo<BracketData>(() => {
    const defaultRun = () => ({ zeit: null, strafe: 0 });
    const assembleMatch = (matchId: string, teamA: Team | null, teamB: Team | null) => {
      const saved = ko[matchId] || {};
      const runA = { ...defaultRun(), ...saved.runA };
      const runB = { ...defaultRun(), ...saved.runB };
      // TODO no Infinity
      const scoreA = runA.zeit !== null ? runA.zeit + (runA.strafe ?? 0) : Infinity;
      const scoreB = runB.zeit !== null ? runB.zeit + (runB.strafe ?? 0) : Infinity;
      let winnerId: string | null = null;
      if (scoreA < Infinity || scoreB < Infinity) {
        winnerId = scoreA <= scoreB ? teamA?.id ?? null : teamB?.id ?? null;
      }
      return { id: matchId, teamA, teamB, runA, runB, winnerId };
    };

    const qf = SEED_ORDER.map(([a, b], i) => assembleMatch(`qf${i + 1}`, top8[a] || null, top8[b] || null));
    const winnerOf = (mid: string) => {
      const m = qf.find((x) => x.id === mid);
      return m?.winnerId ? (m.winnerId === m.teamA?.id ? m.teamA : m.teamB) : null;
    };
    const sf = [
      assembleMatch("sf1", winnerOf("qf1"), winnerOf("qf2")),
      assembleMatch("sf2", winnerOf("qf3"), winnerOf("qf4")),
    ];
    const final = assembleMatch("final", sf[0].winnerId ? (sf[0].winnerId === sf[0].teamA?.id ? sf[0].teamA : sf[0].teamB) : null, sf[1].winnerId ? (sf[1].winnerId === sf[1].teamA?.id ? sf[1].teamA : sf[1].teamB) : null);
    return { qf, sf, final };
  }, [top8, ko]);
  
  const dailyBestTimes = useMemo(() => {
    // A team's Tagesbestzeit is its lowest total across the Grunddurchgang
    // and every K.O. run it took part in.
    const koTotals = new Map<string, number[]>();
    const addRun = (teamId: string, total: number | null) => {
      if (total == null || total <= 0) return;
      const arr = koTotals.get(teamId) ?? [];
      arr.push(total);
      koTotals.set(teamId, arr);
    };
    [...bracket.qf, ...bracket.sf, bracket.final].forEach((m) => {
      if (m.teamA) addRun(m.teamA.id, gesamt(m.runA));
      if (m.teamB) addRun(m.teamB.id, gesamt(m.runB));
    });

    return ranked
      .map((t) => {
        const candidates = [t.punkte, ...(koTotals.get(t.id) ?? [])].filter(
          (v): v is number => v != null && v > 0,
        );
        return { ...t, punkte: candidates.length ? Math.min(...candidates) : 0 };
      })
      .sort(byPunkte);
  }, [bracket, ranked]);

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
  const fillRandomResults = () => {
    if (locked) return;
    const withResults = withRandomResults(teams);
    setTeams(withResults);
    setKo(randomKoResults(withResults));
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
        {tab === "liste" && <>
          <Bestenliste ranked={ranked} top8Ids={new Set(top8.map(t => t.id))} />
          <Gemeindewertung ranked={gemeinde} />
          <Tagesbestzeit ranked={dailyBestTimes.slice(0,3)} />
          </>
        }
        {tab === "monitor" && <LiveMonitor data={monitorData} />}
        {tab === "baum" && <Turnierbaum bracket={bracket} editable={false} />}
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
            setWinner={updateKoRun}
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
          />
          ) : (
            <div className="pin-box">
              <p className="pin-label">Admin-PIN eingeben</p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="pin-input"
                onKeyDown={(e) => e.key === "Enter" && pin === ADMIN_PIN && setAuthed(true)}
              />
              <button
                className="pin-btn"
                onClick={() => setAuthed(pin === ADMIN_PIN)}
              >
                Anmelden
              </button>
              {pin && pin !== ADMIN_PIN && <p className="pin-error">Falscher PIN</p>}
            </div>
          ))}
        </main>
      </div>
  );
}