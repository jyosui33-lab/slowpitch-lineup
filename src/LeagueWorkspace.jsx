// Phase 7: a single League's workspace. Owns the League-scoped state
// (roster, default re-entry policy, season-wide stat lines, and the games
// list) and persists it as one blob under lineupApp.league.<id>. Shows the
// Games list (+ Roster, Season hitting/pitching stats) until a game is opened, at which
// point it renders that Game's full workspace instead.

import { useState, useEffect } from "react";
import { Pencil, Check, Trash2 } from "lucide-react";
import { readLeagueData, writeLeagueData, defaultGame } from "./storage";
import { COLORS } from "./constants";
import { TopHeader } from "./ui";
import RosterCard from "./RosterCard";
import GamesList from "./GamesList";
import SeasonPlaytimeCard from "./SeasonPlaytimeCard";
import SeasonStatsCard from "./SeasonStatsCard";
import SeasonPitchingStatsCard from "./SeasonPitchingStatsCard";
import GameWorkspace from "./GameWorkspace";

export default function LeagueWorkspace({ league, onRenameLeague, onDeleteLeague, onBack }) {
  const [leagueData, setLeagueData] = useState(() => readLeagueData(league.id));
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(league.name);
  const [teamDraft, setTeamDraft] = useState(league.teamName || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    writeLeagueData(league.id, leagueData);
  }, [league.id, leagueData]);

  const { roster: players, defaultLeagueSettings, statLines, games, activeGameId } = leagueData;

  function setPlayers(updater) {
    setLeagueData((prev) => ({ ...prev, roster: typeof updater === "function" ? updater(prev.roster) : updater }));
  }

  function setStatLines(updater) {
    setLeagueData((prev) => ({ ...prev, statLines: typeof updater === "function" ? updater(prev.statLines) : updater }));
  }

  function setActiveGameId(id) {
    setLeagueData((prev) => ({ ...prev, activeGameId: id }));
  }

  // Cascades a player deletion across every game in the league (not just
  // the active one) so no game is left pointing at a player no longer on
  // the roster - mirrors the original single-game deletePlayer's scope
  // (battingOrder + fieldingByInning), just applied to every game.
  function deletePlayer(id) {
    setLeagueData((prev) => ({
      ...prev,
      roster: prev.roster.filter((p) => p.id !== id),
      games: prev.games.map((g) => {
        const battingOrder = g.battingOrder.filter((pid) => pid !== id);
        const fieldingByInning = {};
        for (const inn of Object.keys(g.fieldingByInning)) {
          const chart = { ...g.fieldingByInning[inn] };
          for (const pos of Object.keys(chart)) if (chart[pos] === id) delete chart[pos];
          fieldingByInning[inn] = chart;
        }
        return { ...g, battingOrder, fieldingByInning };
      }),
    }));
  }

  function createGame({ opponent, date, time }) {
    const game = defaultGame({ opponent, date, time, leagueSettings: defaultLeagueSettings });
    setLeagueData((prev) => ({ ...prev, games: [...prev.games, game], activeGameId: game.id }));
  }

  function deleteGame(id) {
    setLeagueData((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g.id !== id),
      statLines: prev.statLines.filter((l) => l.gameId !== id),
      activeGameId: prev.activeGameId === id ? null : prev.activeGameId,
    }));
  }

  const activeGame = games.find((g) => g.id === activeGameId) || null;

  function setActiveGame(updater) {
    setLeagueData((prev) => ({
      ...prev,
      games: prev.games.map((g) => (g.id === activeGameId ? (typeof updater === "function" ? updater(g) : updater) : g)),
    }));
  }

  if (activeGame) {
    return (
      <GameWorkspace
        game={activeGame}
        setGame={setActiveGame}
        players={players}
        setPlayers={setPlayers}
        deletePlayer={deletePlayer}
        statLines={statLines}
        setStatLines={setStatLines}
        leagueName={league.name}
        teamName={league.teamName}
        onBack={() => setActiveGameId(null)}
      />
    );
  }

  function saveRename() {
    const trimmed = nameDraft.trim();
    onRenameLeague({ name: trimmed || league.name, teamName: teamDraft.trim() });
    setRenaming(false);
  }

  return (
    <div>
      <TopHeader
        title={league.name}
        subtitle={league.teamName ? `${league.teamName} — roster, games, and stats for this league.` : "Roster, games, and stats for this league."}
        onBack={onBack}
        right={
          renaming ? null : (
            <span style={{ display: "flex", gap: 4 }}>
              <button
                className="lb-btn"
                onClick={() => {
                  setNameDraft(league.name);
                  setTeamDraft(league.teamName || "");
                  setRenaming(true);
                }}
                style={{ background: "transparent", color: COLORS.chalk, padding: 4, display: "flex" }}
                aria-label="Rename league"
              >
                <Pencil size={16} />
              </button>
              {confirmDelete ? (
                <button
                  className="lb-btn"
                  onClick={onDeleteLeague}
                  style={{ background: COLORS.danger, color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}
                >
                  Confirm
                </button>
              ) : (
                <button className="lb-btn" onClick={() => setConfirmDelete(true)} style={{ background: "transparent", color: COLORS.chalk, padding: 4, display: "flex" }} aria-label="Delete league">
                  <Trash2 size={16} />
                </button>
              )}
            </span>
          )
        }
      />

      {renaming && (
        <div className="lb-page-inner" style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveRename()}
            placeholder="League or season name"
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={teamDraft}
              onChange={(e) => setTeamDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveRename()}
              placeholder="Your team's name"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
            />
            <button className="lb-btn" onClick={saveRename} style={{ background: COLORS.turf, color: "#fff", borderRadius: 8, padding: "0 14px", fontWeight: 700 }} aria-label="Save name">
              <Check size={16} />
            </button>
          </div>
        </div>
      )}

      <RosterCard players={players} setPlayers={setPlayers} onDeletePlayer={deletePlayer} defaultOpen={players.length === 0} teamName={league.teamName} />
      <GamesList games={games} onCreate={createGame} onOpen={setActiveGameId} onDelete={deleteGame} teamName={league.teamName} />
      <SeasonPlaytimeCard games={games} players={players} />
      <SeasonStatsCard statLines={statLines} players={players} />
      <SeasonPitchingStatsCard games={games} players={players} />
    </div>
  );
}
