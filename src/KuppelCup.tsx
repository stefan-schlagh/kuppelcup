import React, { useState, useMemo } from "react";
import { useStorage } from "./hooks/useStorage";
import { seedTeams, gesamt, punkte, SEED_ORDER } from "./utils/helpers";
import type { Team, BracketData } from "./types";
import Bestenliste from "./components/Bestenliste";
import Turnierbaum from "./components/Turnierbaum";
import LiveMonitor from "./components/LiveMonitor";
import AdminPanel from "./components/AdminPanel";

interface StorageMatchState {
  runA?: RunData;
  runB?: RunData;
}
interface StorageKoState {
  [matchId: string]: StorageMatchState;
}

const competitionName = "1. Geissberg KUPPELCUP"
const numberOfParallelRounds = 2

export default function KuppelCup() {
  const [teams, setTeams, teamsLoaded] = useStorage<Team[]>("kuppelcup:teams", seedTeams());
  const [ko, setKo, koLoaded] = useStorage<StorageKoState>("kuppelcup:ko", {});
  const [tab, setTab] = useState<string>("liste");
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const ADMIN_PIN = "2024";

  

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
      .sort((a, b) => b.punkte === 0 ? -1 : (a.punkte) - (b.punkte));
  }, [teams]);

  const eligible = ranked.filter((t) => (!t.gastgeber && punkte(t) !== 0));
  const top8 = eligible.slice(0, 8);
  const bracket = useMemo<BracketData>(() => {
    const defaultRun = () => ({ zeit: null, strafe: 0 });
    const assembleMatch = (matchId: string, teamA: Team | null, teamB: Team | null) => {
      const saved = ko[matchId] || {};
      const runA = { ...defaultRun(), ...saved.runA };
      const runB = { ...defaultRun(), ...saved.runB };
      const scoreA = runA.zeit !== null ? runA.zeit + runA.strafe : Infinity;
      const scoreB = runB.zeit !== null ? runB.zeit + runB.strafe : Infinity;
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

  const updateRun = (teamId: string, dg: "dg1" | "dg2", field: "zeit" | "strafe", value: number | null) => {
    setTeams(teams.map((t) => (t.id === teamId ? { ...t, [dg]: { ...t[dg], [field]: value } } : t)));
  };

  const updateKoRun = (matchId: string, side: "runA" | "runB", field: "zeit" | "strafe", value: number | null) => {
    const current = ko[matchId] || {};
    const currentSide = current[side] || { zeit: null, strafe: 0 };
    setKo({ ...ko, [matchId]: { ...current, [side]: { ...currentSide, [field]: value } } });
  };

  if (!teamsLoaded || !koLoaded) return <div className="loading-screen">Lade Daten…</div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-row">
          <div className="hose-icon">⊃⊂</div>
          <h1 className="brand-title">{competitionName}<span className="brand-year">2026</span></h1>
        </div>
        <nav className="nav-bar">
          {[
            ["liste", "Bestenliste"],
            ["monitor", "Live-Monitor 📺"],
            ["baum", "Turnierbaum"],
            ["admin", "Admin"],
          ].map(([key, label]) => (
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
        {tab === "liste" && <Bestenliste ranked={ranked} top8Ids={new Set(top8.map(t => t.id))} />}
        {tab === "monitor" && <LiveMonitor data={monitorData} />}
        {tab === "baum" && <Turnierbaum bracket={bracket} editable={false} />}
        {tab === "admin" && (
          authed ? (
            <AdminPanel 
            teams={scheduledTeams} /* Passes Fixed Starter Sequence directly down to admin rows */
            updateRun={updateRun} 
            toggleGastgeber={(id) => setTeams(teams.map(t => t.id === id ? {...t, gastgeber: !t.gastgeber} : t))}
            bracket={bracket}
            setWinner={updateKoRun}
            updateKoRun={updateKoRun}
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