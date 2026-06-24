import React, { useState, useMemo } from "react";
import { useStorage } from "./hooks/useStorage";
import { seedTeams, gesamt, SEED_ORDER } from "./utils/helpers";
import type { BracketData, Match, Team, RunData } from "./types";
import Bestenliste from "./components/Bestenliste.tsx";
import Turnierbaum from "./components/Turnierbaum.tsx";
import AdminPanel from "./components/AdminPanel.tsx";

// Define shape of the new KO object inside state storage
interface StorageMatchState {
  runA?: RunData;
  runB?: RunData;
}
interface StorageKoState {
  [matchId: string]: StorageMatchState;
}

export default function KuppelCup() {
  const [teams, setTeams, teamsLoaded] = useStorage<Team[]>("kuppelcup:teams", seedTeams());
  const [ko, setKo, koLoaded] = useStorage<StorageKoState>("kuppelcup:ko", {});
  const [tab, setTab] = useState<string>("liste");
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const ADMIN_PIN = "2024";

  const ranked = useMemo(() => {
    console.log(teams)
    return teams
      .map((t) => {
        const g1 = gesamt(t.dg1);
        const g2 = gesamt(t.dg2);
        const punkte = g1 == null && g2 == null ? null : Math.min(g1 ?? Infinity, g2 ?? Infinity);
        return { ...t, g1, g2, punkte };
      })
      .sort((a, b) => (a.punkte ?? Infinity) - (b.punkte ?? Infinity));
  }, [teams]);

  const eligible = ranked.filter((t) => !t.gastgeber);
  const top8 = eligible.slice(0, 8);
  const top8Ids = useMemo(() => new Set(top8.map((t) => t.id)), [top8]);

  const updateRun = (teamId, dg, field, value) => {
    const next = teams.map((t) =>
      t.id === teamId ? { ...t, [dg]: { ...t[dg], [field]: value } } : t
    );
    setTeams(next);
  };

  const toggleGastgeber = (teamId) => {
    const next = teams.map((t) =>
      t.id === teamId ? { ...t, gastgeber: !t.gastgeber } : t
    );
    setTeams(next);
  };

  const setWinner = (matchId, teamId) => {
    setKo({ ...ko, [matchId]: teamId });
  };

  // Main bracket compiler loop
  const bracket = useMemo<BracketData>(() => {
    const defaultRun = () => ({ zeit: null, strafe: 0 });

    // Helper utility to calculate metrics dynamically
    const assembleMatch = (matchId: string, teamA: Team | null, teamB: Team | null): Match => {
        console.log(ko)
      const savedData = ko[matchId] || {};
      const runA: RunData = { ...defaultRun(), ...savedData.runA };
      const runB: RunData = { ...defaultRun(), ...savedData.runB };

      // Calculate dynamic winners: lowest overall time wins
      const scoreA = runA.zeit !== null ? runA.zeit + runA.strafe : Infinity;
      const scoreB = runB.zeit !== null ? runB.zeit + runB.strafe : Infinity;

      let winnerId: string | null = null;
      if (scoreA < Infinity || scoreB < Infinity) {
        winnerId = scoreA <= scoreB ? teamA?.id ?? null : teamB?.id ?? null;
      }

      return { id: matchId, teamA, teamB, runA, runB, winnerId };
    };

    // 1. Quarterfinals
    const qf = SEED_ORDER.map(([a, b], i) => 
      assembleMatch(`qf${i + 1}`, top8[a] || null, top8[b] || null)
    );

    const getWinnerOf = (mid: string): Team | null => {
      const matchObj = qf.find((x) => x.id === mid);
      if (!matchObj || !matchObj.winnerId) return null;
      return matchObj.winnerId === matchObj.teamA?.id ? matchObj.teamA : matchObj.teamB;
    };

    // 2. Semifinals
    const sf = [
      assembleMatch("sf1", getWinnerOf("qf1"), getWinnerOf("qf2")),
      assembleMatch("sf2", getWinnerOf("qf3"), getWinnerOf("qf4"))
    ];

    const getWinnerOfSf = (mid: string): Team | null => {
      const matchObj = sf.find((x) => x.id === mid);
      if (!matchObj || !matchObj.winnerId) return null;
      return matchObj.winnerId === matchObj.teamA?.id ? matchObj.teamA : matchObj.teamB;
    };

    // 3. Finals
    const final = assembleMatch("final", getWinnerOfSf("sf1"), getWinnerOfSf("sf2"));

    return { qf, sf, final };
  }, [top8, ko]);

  // New action handler callback signature 
  const updateKoRun = (
    matchId: string, 
    side: "runA" | "runB", 
    field: "zeit" | "strafe", 
    value: number | null
  ) => {
    const currentMatch = ko[matchId] || {};
    const currentSide = currentMatch[side] || { zeit: null, strafe: 0 };

    const updatedMatchData = {
      ...currentMatch,
      [side]: {
        ...currentSide,
        [field]: value
      }
    };

    setKo({
      ...ko,
      [matchId]: updatedMatchData
    });
  };

  if (!teamsLoaded || !koLoaded) {
    return <div className="loading-screen">Lade Daten…</div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-row">
          <div className="hoseIcon">⊃⊂</div>
          <h1 className="brand-title">KUPPELCUP <span className="brand-year">2026</span></h1>
        </div>
        <nav className="nav-bar">
          {[
            ["liste", "Bestenliste"],
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
        {tab === "liste" && <Bestenliste ranked={ranked} top8Ids={top8Ids} />}
        {tab === "baum" && (
          <Turnierbaum 
            bracket={bracket} 
            editable={false}
          />
        )}
        {tab === "admin" && (
          authed ? (
            <AdminPanel
              teams={teams}
              //ranked={ranked}
              updateRun={updateRun}
              toggleGastgeber={toggleGastgeber}
              bracket={bracket}
              setWinner={setWinner}
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
          )
        )}
      </main>

      <footer className="app-footer">
        Strafzeiten summieren sich pro Durchgang (Standard 5s/10s/20s) · Punkte = bessere von (Zeit + Strafe) aus DG1/DG2
      </footer>
    </div>
  );
}/*
export default function KuppelCup() {
  const [teams, setTeams, teamsLoaded] = useStorage("kuppelcup:teams", seedTeams());
  const [ko, setKo, koLoaded] = useStorage("kuppelcup:ko", {});
  const [tab, setTab] = useState("liste");
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const ADMIN_PIN = "2024";

  const ranked = useMemo(() => {
    return teams
      .map((t) => {
        const g1 = gesamt(t.dg1);
        const g2 = gesamt(t.dg2);
        const punkte = g1 == null && g2 == null ? null : Math.min(g1 ?? Infinity, g2 ?? Infinity);
        return { ...t, g1, g2, punkte };
      })
      .sort((a, b) => (a.punkte ?? Infinity) - (b.punkte ?? Infinity));
  }, [teams]);

  const eligible = ranked.filter((t) => !t.gastgeber);
  const top8 = eligible.slice(0, 8);
  const top8Ids = useMemo(() => new Set(top8.map((t) => t.id)), [top8]);

  const bracket = useMemo(() => {
    const qf = SEED_ORDER.map(([a, b], i) => ({
      id: `qf${i + 1}`,
      teamA: top8[a],
      teamB: top8[b],
      winnerId: ko[`qf${i + 1}`] || null,
    }));
    
    const winnerOf = (mid) => {
      const m = qf.find((x) => x.id === mid);
      if (!m || !m.winnerId) return null;
      return m.winnerId === m.teamA?.id ? m.teamA : m.teamB;
    };
    
    const sf = [
      { id: "sf1", teamA: winnerOf("qf1"), teamB: winnerOf("qf2"), winnerId: ko.sf1 || null },
      { id: "sf2", teamA: winnerOf("qf3"), teamB: winnerOf("qf4"), winnerId: ko.sf2 || null },
    ];
    
    const winnerOfSf = (mid) => {
      const m = sf.find((x) => x.id === mid);
      if (!m || !m.winnerId) return null;
      return m.winnerId === m.teamA?.id ? m.teamA : m.teamB;
    };
    
    const final = { id: "final", teamA: winnerOfSf("sf1"), teamB: winnerOfSf("sf2"), winnerId: ko.final || null };
    return { qf, sf, final };
  }, [top8, ko]);

  

  
}*/