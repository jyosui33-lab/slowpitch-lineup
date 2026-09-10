// Phase 5: player stats tracking (Section 3.3 / 9 of the architecture doc).
//
// There's no multi-game Game[] model yet (Phase 7 is deliberately deferred),
// so GameStatLine rows aren't attached to a real Game object - they're a
// flat list in localStorage, each tagged with an auto-generated gameId +
// date captured when "Start game" is hit. That's enough to support a
// season rollup and a per-game log without building the full multi-game
// rewrite first, following the same "parallel structure, don't rewrite"
// pattern as battingSlots (Decision 27).

export const STAT_FIELDS = [
  { key: "PA", label: "PA" },
  { key: "singles", label: "1B" },
  { key: "doubles", label: "2B" },
  { key: "triples", label: "3B" },
  { key: "HR", label: "HR" },
  { key: "BB", label: "BB" },
  { key: "K", label: "K" },
  { key: "GO", label: "GO" },
  { key: "FO", label: "FO" },
  { key: "LO", label: "LO" },
];

export function emptyStatLine() {
  const line = {};
  for (const f of STAT_FIELDS) line[f.key] = 0;
  return line;
}

// Soft validation only (Section 9: "flag a warning ... rather than hard-
// blocking", since hand-scored totals can have small discrepancies a coach
// may still want to enter as-is).
export function reconcileWarning(line) {
  const outcomes =
    line.singles + line.doubles + line.triples + line.HR + line.BB + line.K + line.GO + line.FO + line.LO;
  if (line.PA < outcomes) {
    return `PA (${line.PA}) is less than total outcomes (${outcomes}).`;
  }
  return null;
}

function sumStatLines(lines) {
  const totals = emptyStatLine();
  for (const line of lines) {
    for (const f of STAT_FIELDS) totals[f.key] += line[f.key] || 0;
  }
  return totals;
}

// AB/H/TB per Section 3.3's formula table - derived, never stored.
function deriveFromLine(line) {
  const AB = line.PA - line.BB;
  const H = line.singles + line.doubles + line.triples + line.HR;
  const TB = line.singles + 2 * line.doubles + 3 * line.triples + 4 * line.HR;
  return { AB, H, TB, BB: line.BB };
}

// league is { OBP, SLG } or null (no OPS+ baseline available yet, e.g. team
// has zero AB logged so far).
function rateStats({ AB, H, TB, BB }, league) {
  const AVG = AB > 0 ? H / AB : 0;
  const OBP = AB + BB > 0 ? (H + BB) / (AB + BB) : 0;
  const SLG = AB > 0 ? TB / AB : 0;
  const OPS = OBP + SLG;
  const OPSplus =
    league && league.OBP > 0 && league.SLG > 0 ? 100 * (OBP / league.OBP + SLG / league.SLG - 1) : null;
  return { AVG, OBP, SLG, OPS, OPSplus };
}

// Per-game rate line for the PlayerStatsCard log - no OPS+ here, since the
// doc only defines that baseline at the season/team level (Section 3.3).
export function statLineRates(line) {
  return rateStats(deriveFromLine(line), null);
}

// Season rollup (Section 3.3, confirmed): sum counting stats across every
// game first, then compute rate stats once from the summed totals - never
// average per-game rates, which distorts AVG/OBP/SLG when players have
// uneven at-bats per game.
export function computeSeasonStats(statLines, players) {
  const byPlayer = {};
  for (const line of statLines) {
    (byPlayer[line.playerId] ||= []).push(line);
  }

  // OPS+ baseline: the team's own combined season totals stand in for
  // "league average" (Section 3.3 / Decision 11) - no external league feed.
  const teamTotals = sumStatLines(statLines);
  const teamRates = rateStats(deriveFromLine(teamTotals), null);
  const league = { OBP: teamRates.OBP, SLG: teamRates.SLG };

  return players.map((p) => {
    const lines = (byPlayer[p.id] || []).slice().sort((a, b) => (a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : 0));
    const totals = sumStatLines(lines);
    const derived = deriveFromLine(totals);
    const rates = rateStats(derived, league);
    return {
      playerId: p.id,
      gamesPlayed: lines.length,
      games: lines,
      PA: totals.PA,
      AB: derived.AB,
      H: derived.H,
      BB: totals.BB,
      K: totals.K,
      TB: derived.TB,
      ...rates,
    };
  });
}
