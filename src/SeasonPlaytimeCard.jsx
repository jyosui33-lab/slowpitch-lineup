// Season-wide playtime leaderboard - the multi-game counterpart to each
// game's own "Playtime report" (GameWorkspace.jsx), summed across every
// completed inning in every game via computeSeasonPlaytime.

import { useState, Fragment } from "react";
import { COLORS } from "./constants";
import { computeSeasonPlaytime } from "./battingRules";
import { CollapsibleCard } from "./ui";

export default function SeasonPlaytimeCard({ games, players }) {
  const [open, setOpen] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [sortKey, setSortKey] = useState("satOutInnings");
  const [sortDir, setSortDir] = useState("desc");

  const playerById = (id) => players.find((p) => p.id === id);
  const { rows, totalInningsCompleted, gamesWithData } = computeSeasonPlaytime(games, players);

  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return av === bv ? 0 : av < bv ? -1 * dir : 1 * dir;
  });

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
      <CollapsibleCard
        title="Season playtime report"
        subtitle={gamesWithData > 0 ? `${totalInningsCompleted} inning${totalInningsCompleted === 1 ? "" : "s"} across ${gamesWithData} game${gamesWithData === 1 ? "" : "s"}` : undefined}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {gamesWithData === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            No playtime data yet — complete an inning in a game to start tracking it here.
          </div>
        ) : players.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>No players on the roster yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ textAlign: "left", padding: "6px 8px 6px 4px", color: COLORS.inkSoft, whiteSpace: "nowrap" }}>
                    Player
                  </th>
                  {[
                    { key: "gamesPlayed", label: "GP" },
                    { key: "battedInnings", label: "Batted" },
                    { key: "fieldedInnings", label: "Fielded" },
                    { key: "satOutInnings", label: "Sat out" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      style={{
                        textAlign: "right",
                        padding: "6px 4px",
                        color: sortKey === col.key ? COLORS.ink : COLORS.inkSoft,
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.label}
                      {sortKey === col.key && (sortDir === "asc" ? " ▲" : " ▼")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const p = playerById(r.playerId);
                  if (!p) return null;
                  const expanded = expandedPlayerId === r.playerId;
                  return (
                    <Fragment key={r.playerId}>
                      <tr
                        className="lb-btn"
                        onClick={() => setExpandedPlayerId(expanded ? null : r.playerId)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                      >
                        <td style={{ padding: "6px 8px 6px 4px", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {p.name} <span style={{ color: COLORS.muted, fontWeight: 700 }}>#{p.jerseyNumber || "–"}</span>
                        </td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.gamesPlayed}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.battedInnings}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.fieldedInnings}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right", color: r.satOutInnings > 0 ? COLORS.danger : COLORS.muted }}>
                          {r.satOutInnings}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: "4px 4px 12px", background: COLORS.chalk }}>
                            {r.games.length === 0 ? (
                              <div style={{ fontSize: 12, color: COLORS.muted, padding: "6px 4px" }}>No per-game log yet.</div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: "left", padding: "4px", color: COLORS.muted }}>Game</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>Innings</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>Batted</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>Fielded</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.games.map((g, i) => (
                                    <tr key={i}>
                                      <td style={{ padding: "4px", whiteSpace: "nowrap" }}>
                                        {g.opponent?.trim() ? `vs. ${g.opponent}` : "—"} {g.date && <span style={{ color: COLORS.muted }}>({g.date})</span>}
                                      </td>
                                      <td style={{ padding: "4px", textAlign: "right" }}>{g.innings}</td>
                                      <td style={{ padding: "4px", textAlign: "right" }}>{g.batted}</td>
                                      <td style={{ padding: "4px", textAlign: "right" }}>{g.fielded}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleCard>
    </section>
  );
}
