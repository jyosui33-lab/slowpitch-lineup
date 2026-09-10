// Per-inning score entry, laid out like a ballpark scoreboard: one row per
// team, one column per inning, plus a runs total. Runs are stored sparsely
// on the game (scores.us / scores.them, keyed by inning) so an inning nobody
// has played yet stays blank instead of reading as a 0 someone entered.

import { useState } from "react";
import { COLORS, INNINGS, emptyScores, gameScoreSummary } from "./constants";
import { CollapsibleCard } from "./ui";

const CELL_WIDTH = 34;

export default function GameScoresCard({ game, setGame, teamName }) {
  const [open, setOpen] = useState(false);

  const scores = game.scores || emptyScores();
  const summary = gameScoreSummary(game);
  const usLabel = teamName?.trim() || "Us";
  const themLabel = game.opponent?.trim() || "Opponent";

  function setRuns(side, inning, raw) {
    setGame((prev) => {
      const prevScores = prev.scores || emptyScores();
      const sideScores = { ...(prevScores[side] || {}) };
      if (raw === "") {
        delete sideScores[inning];
      } else {
        sideScores[inning] = Math.max(0, Math.floor(Number(raw) || 0));
      }
      return { ...prev, scores: { ...prevScores, [side]: sideScores } };
    });
  }

  function sideTotal(side) {
    return Object.values(scores[side] || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  const resultTone = summary.result === "W" ? COLORS.turfLight : summary.result === "L" ? COLORS.danger : COLORS.gold;
  const resultLabel = summary.result === "W" ? "Win" : summary.result === "L" ? "Loss" : "Tied";

  function row(side, label) {
    return (
      <tr>
        <th
          scope="row"
          style={{
            textAlign: "left",
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.chalk,
            whiteSpace: "nowrap",
            maxWidth: 130,
            overflow: "hidden",
            textOverflow: "ellipsis",
            position: "sticky",
            left: 0,
            background: COLORS.ink,
          }}
        >
          {label}
        </th>
        {INNINGS.map((n) => (
          <td key={n} style={{ padding: "4px 3px", textAlign: "center" }}>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              aria-label={`${label} runs in inning ${n}`}
              value={scores[side]?.[n] ?? ""}
              onChange={(e) => setRuns(side, n, e.target.value)}
              onFocus={(e) => e.target.select()}
              style={{
                width: CELL_WIDTH,
                padding: "6px 2px",
                borderRadius: 6,
                border: `1px solid ${COLORS.inkSoft}`,
                background: "rgba(255,255,255,0.06)",
                color: COLORS.chalk,
                fontSize: 14,
                fontWeight: 700,
                textAlign: "center",
              }}
            />
          </td>
        ))}
        <td
          style={{
            padding: "4px 10px 4px 8px",
            textAlign: "center",
            fontSize: 18,
            fontWeight: 800,
            color: COLORS.gold,
            borderLeft: `1px solid ${COLORS.inkSoft}`,
          }}
        >
          {sideTotal(side)}
        </td>
      </tr>
    );
  }

  return (
    <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
      <CollapsibleCard
        title="Game scores"
        subtitle={summary.hasScores ? `${summary.us} – ${summary.them}` : undefined}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        <div style={{ background: COLORS.ink, borderRadius: 12, padding: "8px 0", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 10px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: COLORS.muted,
                    position: "sticky",
                    left: 0,
                    background: COLORS.ink,
                  }}
                >
                  Inning
                </th>
                {INNINGS.map((n) => (
                  <th key={n} style={{ padding: "4px 3px 8px", fontSize: 12, fontWeight: 800, color: COLORS.muted, textAlign: "center", width: CELL_WIDTH }}>
                    {n}
                  </th>
                ))}
                <th style={{ padding: "4px 10px 8px 8px", fontSize: 12, fontWeight: 800, color: COLORS.gold, textAlign: "center" }}>R</th>
              </tr>
            </thead>
            <tbody>
              {row("us", usLabel)}
              {row("them", themLabel)}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: COLORS.muted }}>
          {summary.hasScores ? (
            <span>
              <span style={{ color: resultTone, fontWeight: 800 }}>{resultLabel}</span> — {usLabel} {summary.us}, {themLabel} {summary.them}
            </span>
          ) : (
            <span>Enter runs by inning — leave an inning blank until it's played.</span>
          )}
        </div>
      </CollapsibleCard>
    </section>
  );
}
