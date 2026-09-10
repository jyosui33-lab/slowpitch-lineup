// Section 6: the printable/exportable lineup card. This node is always
// mounted (via a portal in GameWorkspace) but kept off-screen by the
// .printable-card CSS rule in App.jsx, so it's available at any time for
// html2canvas to capture (print.js's PDF export, primary on mobile) and is
// swapped on-screen only by the @media print rule when the coach uses the
// browser's own Print flow (window.print(), the desktop fallback).
import { forwardRef } from "react";
import { getSlotBadge, computeParticipation, orderPlayersByStartingLineup } from "./battingRules";
import { POSITIONS, EP_SLOTS, gameLabel, isGameOver } from "./constants";

const th = { textAlign: "left", padding: "4px 8px", borderBottom: "2px solid #111", fontSize: 11, whiteSpace: "nowrap" };
const td = { padding: "4px 8px", borderBottom: "1px solid #ccc", fontSize: 12 };

const PrintableLineupCard = forwardRef(function PrintableLineupCard({ game, players, leagueName, teamName }, ref) {
  const { battingOrder, battingOrderSize, battingSlots, fieldingByInning, completedInnings, leagueSettings, gameStarted, startingAssignments, activeInning } = game;
  const gameOver = isGameOver(game);
  const playerById = (id) => players.find((p) => p.id === id);

  // Same EP-count derivation as the fielding diamond (Decision 21): up to
  // four EP columns, driven by how far battingOrderSize goes past 10.
  const epCount = Math.max(0, Math.min(EP_SLOTS.length, battingOrderSize - 10));
  const allSlots = [...POSITIONS, ...EP_SLOTS.slice(0, epCount)];
  const inningNumbers = Object.keys(fieldingByInning).map(Number).sort((a, b) => a - b);

  const currentFielding = fieldingByInning[activeInning] || {};
  function currentPositionLabel(playerId) {
    const entry = Object.entries(currentFielding).find(([, pid]) => pid === playerId);
    return entry ? entry[0] : "Bench";
  }

  const hasPlaytimeData = completedInnings.length > 0;
  const { participation, completedInningsSorted } = hasPlaytimeData
    ? computeParticipation({ players, battingOrder, battingSlots, fieldingByInning, completedInnings })
    : { participation: {}, completedInningsSorted: [] };
  const playersInLineupOrder = orderPlayersByStartingLineup(players, battingSlots);

  return (
    <div ref={ref} style={{ width: 760, background: "#fff", color: "#111", padding: 32, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px solid #111", paddingBottom: 8, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{leagueName}</div>
          <div style={{ fontSize: 14, color: "#333" }}>{gameLabel(game, teamName)}</div>
        </div>
        <div style={{ fontSize: 11, color: "#666", textAlign: "right" }}>
          <div>{gameStarted ? "In progress" : gameOver ? "Completed" : "Not started"}</div>
          <div>Re-entry: {leagueSettings.reEntryPolicy === "once" ? "Once per starter" : "Unlimited"}</div>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Batting Order</div>
      {battingOrder.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>No batting order set yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Player</th>
              <th style={th}>Jersey</th>
              <th style={th}>Starting</th>
              <th style={th}>Current</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {battingOrder.map((pid, i) => {
              const p = playerById(pid);
              if (!p) return null;
              const starterName = playerById(battingSlots[i]?.starterId)?.name;
              const badge = getSlotBadge(battingSlots, i, pid, leagueSettings.reEntryPolicy, undefined, starterName);
              return (
                <tr key={pid}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{p.name}</td>
                  <td style={td}>#{p.jerseyNumber || "–"}</td>
                  <td style={td}>{gameStarted || gameOver ? startingAssignments[pid] || "Bench" : "—"}</td>
                  <td style={td}>{currentPositionLabel(pid)}</td>
                  <td style={td}>{badge ? badge.label : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {inningNumbers.length > 0 && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Fielding Chart</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={th}>Position</th>
                {inningNumbers.map((n) => (
                  <th key={n} style={{ ...th, textAlign: "center" }}>
                    Inn {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSlots.map((pos) => (
                <tr key={pos.id}>
                  <td style={{ ...td, fontWeight: 700 }}>{pos.id}</td>
                  {inningNumbers.map((n) => {
                    const chart = fieldingByInning[n] || {};
                    const occ = playerById(chart[pos.id]);
                    return (
                      <td key={n} style={{ ...td, textAlign: "center" }}>
                        {occ ? `${occ.name} #${occ.jerseyNumber || "–"}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {hasPlaytimeData && (
        <div style={{ pageBreakBefore: "always" }}>
          <div style={{ fontSize: 15, fontWeight: 700, margin: "8px 0 6px" }}>Playtime Report</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Player</th>
                <th style={{ ...th, textAlign: "right" }}>Batted</th>
                <th style={{ ...th, textAlign: "right" }}>Fielded</th>
                <th style={{ ...th, textAlign: "right" }}>Sat out</th>
              </tr>
            </thead>
            <tbody>
              {playersInLineupOrder.map((p) => {
                const stats = participation[p.id] || { battedInnings: new Set(), fieldedInnings: new Set() };
                const batted = stats.battedInnings.size;
                const fielded = stats.fieldedInnings.size;
                const satOut = Math.max(0, completedInningsSorted.length - batted);
                return (
                  <tr key={p.id}>
                    <td style={td}>
                      {p.name} #{p.jerseyNumber || "–"}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{batted}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fielded}</td>
                    <td style={{ ...td, textAlign: "right" }}>{satOut}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 10, color: "#999" }}>Generated {new Date().toLocaleString()}</div>
    </div>
  );
});

export default PrintableLineupCard;
