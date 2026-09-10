// Season hitting stats leaderboard (Section 9), extracted from the original
// single-file App.jsx. Now rendered at the League level (not per-game) since
// statLines are league-wide, spanning every game in the league. See
// SeasonPitchingStatsCard.jsx for the pitching counterpart.

import { useState, Fragment } from "react";
import { COLORS } from "./constants";
import { computeSeasonStats, statLineRates } from "./stats";
import { CollapsibleCard } from "./ui";

function formatRate(v) {
  if (v == null) return "—";
  const s = v.toFixed(3);
  return v < 1 ? s.replace(/^0\./, ".") : s;
}

function formatOpsPlus(v) {
  if (v == null) return "—";
  const r = Math.round(v);
  return r > 0 ? `+${r}` : `${r}`;
}

export default function SeasonStatsCard({ statLines, players }) {
  const [open, setOpen] = useState(false);
  const [expandedStatsPlayerId, setExpandedStatsPlayerId] = useState(null);
  const [statsSortKey, setStatsSortKey] = useState("OPS");
  const [statsSortDir, setStatsSortDir] = useState("desc");

  const playerById = (id) => players.find((p) => p.id === id);
  const seasonStats = computeSeasonStats(statLines, players);
  const sortedSeasonStats = [...seasonStats].sort((a, b) => {
    const dir = statsSortDir === "asc" ? 1 : -1;
    const av = a[statsSortKey] ?? -Infinity;
    const bv = b[statsSortKey] ?? -Infinity;
    return av === bv ? 0 : av < bv ? -1 * dir : 1 * dir;
  });

  function toggleStatsSort(key) {
    if (statsSortKey === key) {
      setStatsSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setStatsSortKey(key);
      setStatsSortDir("desc");
    }
  }

  return (
    <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
      <CollapsibleCard
        title="Season hitting stats"
        subtitle={statLines.length > 0 ? `${new Set(statLines.map((l) => l.gameId)).size} games logged` : undefined}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {statLines.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            No stats entered yet — complete a game and enter its stats from that game's page.
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
                    { key: "gamesPlayed", label: "GP" },
                    { key: "PA", label: "PA" },
                    { key: "AVG", label: "AVG" },
                    { key: "OBP", label: "OBP" },
                    { key: "SLG", label: "SLG" },
                    { key: "OPS", label: "OPS" },
                    { key: "OPSplus", label: "OPS+" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleStatsSort(col.key)}
                      style={{
                        textAlign: "right",
                        padding: "6px 4px",
                        color: statsSortKey === col.key ? COLORS.ink : COLORS.inkSoft,
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.label}
                      {statsSortKey === col.key && (statsSortDir === "asc" ? " ▲" : " ▼")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSeasonStats.map((s) => {
                  const p = playerById(s.playerId);
                  if (!p) return null;
                  const expanded = expandedStatsPlayerId === s.playerId;
                  return (
                    <Fragment key={s.playerId}>
                      <tr
                        className="lb-btn"
                        onClick={() => setExpandedStatsPlayerId(expanded ? null : s.playerId)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                      >
                        <td style={{ padding: "6px 8px 6px 4px", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {p.name} <span style={{ color: COLORS.muted, fontWeight: 700 }}>#{p.jerseyNumber || "–"}</span>
                        </td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{s.gamesPlayed}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{s.PA}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatRate(s.AVG)}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatRate(s.OBP)}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatRate(s.SLG)}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatRate(s.OPS)}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatOpsPlus(s.OPSplus)}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: "4px 4px 12px", background: COLORS.chalk }}>
                            {s.games.length === 0 ? (
                              <div style={{ fontSize: 12, color: COLORS.muted, padding: "6px 4px" }}>No per-game log yet.</div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: "left", padding: "4px", color: COLORS.muted }}>Date</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>PA</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>AVG</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>OBP</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>SLG</th>
                                    <th style={{ textAlign: "right", padding: "4px", color: COLORS.muted }}>OPS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.games.map((line, i) => {
                                    const rates = statLineRates(line);
                                    return (
                                      <tr key={i}>
                                        <td style={{ padding: "4px", whiteSpace: "nowrap" }}>{line.gameDate || "—"}</td>
                                        <td style={{ padding: "4px", textAlign: "right" }}>{line.PA}</td>
                                        <td style={{ padding: "4px", textAlign: "right" }}>{formatRate(rates.AVG)}</td>
                                        <td style={{ padding: "4px", textAlign: "right" }}>{formatRate(rates.OBP)}</td>
                                        <td style={{ padding: "4px", textAlign: "right" }}>{formatRate(rates.SLG)}</td>
                                        <td style={{ padding: "4px", textAlign: "right" }}>{formatRate(rates.OPS)}</td>
                                      </tr>
                                    );
                                  })}
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
