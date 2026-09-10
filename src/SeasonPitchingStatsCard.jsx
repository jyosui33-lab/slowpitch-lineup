// Season-long pitching leaderboard (league level), the pitching counterpart
// to SeasonStatsCard's hitting leaderboard. Entirely derived from data that
// already exists - who was placed at P each inning (fieldingByInning) and
// how many runs the opponent scored that inning (Game scores, per-inning) -
// via computeSeasonPitching, so there's no separate pitching entry form.

import { useState, Fragment } from "react";
import { COLORS } from "./constants";
import { computeSeasonPitching } from "./battingRules";
import { CollapsibleCard } from "./ui";

function formatRA5(v) {
  if (v == null) return "—";
  return v.toFixed(2);
}

export default function SeasonPitchingStatsCard({ games, players }) {
  const [open, setOpen] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [sortKey, setSortKey] = useState("inningsPitched");
  const [sortDir, setSortDir] = useState("desc");

  const playerById = (id) => players.find((p) => p.id === id);
  const { rows } = computeSeasonPitching(games, players);

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
      setSortDir(key === "ra5" ? "asc" : "desc");
    }
  }

  return (
    <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
      <CollapsibleCard
        title="Season pitching stats"
        subtitle={rows.length > 0 ? `${rows.length} pitcher${rows.length === 1 ? "" : "s"}` : undefined}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            No pitching data yet — complete an inning with a player placed at P, and enter that inning's runs allowed on the Game scores card.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ textAlign: "left", padding: "6px 8px 6px 4px", color: COLORS.inkSoft, whiteSpace: "nowrap" }}>
                    Player
                  </th>
                  {[
                    { key: "gamesPitched", label: "GP" },
                    { key: "inningsPitched", label: "IP" },
                    { key: "runsAllowed", label: "RA" },
                    { key: "ra5", label: "RA/5" },
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
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.gamesPitched}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.inningsPitched}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.runsAllowed}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatRA5(r.ra5)}</td>
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
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>IP</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>RA</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.games.map((g, i) => (
                                    <tr key={i}>
                                      <td style={{ padding: "4px", whiteSpace: "nowrap" }}>
                                        {g.opponent?.trim() ? `vs. ${g.opponent}` : "—"} {g.date && <span style={{ color: COLORS.muted }}>({g.date})</span>}
                                      </td>
                                      <td style={{ padding: "4px", textAlign: "right" }}>{g.innings}</td>
                                      <td style={{ padding: "4px", textAlign: "right" }}>{g.runs}</td>
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
