// Phase 4: re-entry rules engine + playtime derivation.
//
// battingOrder (App.jsx) stays the single source of truth for slot order.
// battingSlots is a parallel structure, keyed by index into battingOrder,
// that records each slot's original starter and the history of who has
// occupied it since the game started. It only exists from "Start game"
// onward (Decision 25 keeps battingOrder indices stable post-lock, except
// for same-index substitution replacement per Decision 24), so the whole
// engine naturally applies only once a game is in progress.

// Snapshot every current battingOrder entry as its slot's starter. Called
// once, from the "Start game" handler.
export function createBattingSlots(battingOrder, inning) {
  const slots = {};
  battingOrder.forEach((playerId, idx) => {
    slots[idx] = {
      starterId: playerId,
      history: [{ inning, playerId, eventType: "starter" }],
    };
  });
  return slots;
}

// Who occupied this slot as of the given inning: among all history events
// with event.inning <= the one asked about, the one with the highest
// event.inning (ties broken by whichever was recorded later). Ranked by
// event.inning rather than array position because a locked inning can be
// reopened and edited after later innings already happened, so insertion
// order and inning order aren't guaranteed to match.
export function occupantAtInning(slot, inning) {
  let occupant = null;
  let bestInning = -Infinity;
  for (const event of slot.history) {
    if (event.inning > inning) continue;
    // >= so that among same-inning events, the one recorded later (further
    // along in array order) wins - matches "last sub in that inning stands".
    if (event.inning >= bestInning) {
      bestInning = event.inning;
      occupant = event.playerId;
    }
  }
  return occupant;
}

// Finds the slot a returning player should re-enter, identified by their own
// identity (they're recorded as some slot's original starterId and aren't
// its current occupant) rather than by which fielding position they're
// being placed at. Re-entry is about the batting slot (Section 3.1), not
// the fielding position - a starter may legitimately re-enter at a
// different defensive position than the one they started at (Decision 21's
// free rotation), so resolving "whose slot is this" by position (whoever
// else happens to be standing at the tapped spot) is wrong; it must be
// resolved by who the incoming player themselves is. Returns -1 if
// playerId isn't a starter currently out of the lineup.
export function findReentrySlot(battingSlots, battingOrder, playerId) {
  for (const idxStr of Object.keys(battingSlots)) {
    const idx = Number(idxStr);
    const slot = battingSlots[idx];
    if (slot.starterId === playerId && battingOrder[idx] !== playerId) {
      return idx;
    }
  }
  return -1;
}

// True if playerId has already been removed from some slot as a substitute
// (not that slot's starter) and isn't its current occupant. A permanently
// barred substitute can never enter any slot again, for the rest of the
// game. Starters are never barred this way - their re-entry is governed by
// reEntryCount/policy instead (see validateSubstitution).
export function isBarred(battingSlots, battingOrder, playerId) {
  for (const idxStr of Object.keys(battingSlots)) {
    const idx = Number(idxStr);
    const slot = battingSlots[idx];
    if (slot.starterId === playerId) continue;
    const wasSub = slot.history.some(
      (e) => e.eventType === "substitute" && e.playerId === playerId
    );
    if (wasSub && battingOrder[idx] !== playerId) return true;
  }
  return false;
}

// How many times the slot's starter has already re-entered (returned after
// being subbed out), counting only events at or before uptoInning - lets a
// badge shown while viewing a locked past inning reflect the game's state
// as of that inning, not the full-game total.
function reEntryCount(slot, uptoInning = Infinity) {
  return slot.history.filter((e) => e.eventType === "starter-reentry" && e.inning <= uptoInning).length;
}

// Validates bringing incomingPlayerId into slotIndex, replacing whoever is
// there now. Returns { ok: true } or { ok: false, reason, message }.
export function validateSubstitution(battingSlots, battingOrder, slotIndex, incomingPlayerId, reEntryPolicy) {
  const slot = battingSlots[slotIndex];
  if (!slot) return { ok: true };

  if (incomingPlayerId === slot.starterId) {
    const count = reEntryCount(slot);
    const limitReached = reEntryPolicy === "once" ? count >= 1 : false;
    if (limitReached) {
      return {
        ok: false,
        reason: "reentry-exhausted",
        message: `has already used their re-entry for this slot.`,
      };
    }
    return { ok: true };
  }

  if (isBarred(battingSlots, battingOrder, incomingPlayerId)) {
    return {
      ok: false,
      reason: "barred",
      message: `already left the game and can't return.`,
    };
  }

  return { ok: true };
}

// Pure: appends the appropriate history event to the slot and returns a new
// battingSlots object. Call only after validateSubstitution has approved it.
export function recordSubstitution(battingSlots, slotIndex, incomingPlayerId, inning) {
  const slot = battingSlots[slotIndex];
  if (!slot) return battingSlots;
  const eventType = incomingPlayerId === slot.starterId ? "starter-reentry" : "substitute";
  const nextSlot = {
    ...slot,
    history: [...slot.history, { inning, playerId: incomingPlayerId, eventType }],
  };
  return { ...battingSlots, [slotIndex]: nextSlot };
}

const REENTRY_TONE = "reentered";
const SUB_TONE = "sub";
const STARTER_TONE = "starter";

// Small status badge for a batting-order row: Starter / In for <name> /
// Re-entered. Returns null before the game has started (no slot data yet to
// show). Pass atInning when viewing a locked past inning so the re-entry
// count reflects the game's state as of that inning, not the full-game
// total. Pass starterName (the departed starter's display name) so the "Sub"
// case reads as "already in the lineup for them" rather than "still on the
// bench" - the two are easy to conflate since both involve the word "sub".
export function getSlotBadge(battingSlots, slotIndex, playerId, reEntryPolicy, atInning = Infinity, starterName) {
  const slot = battingSlots[slotIndex];
  if (!slot) return null;

  if (playerId !== slot.starterId) {
    return { label: starterName ? `In for ${starterName}` : "Sub", tone: SUB_TONE };
  }

  const count = reEntryCount(slot, atInning);
  if (count === 0) {
    return { label: "Starter", tone: STARTER_TONE };
  }
  const denominator = reEntryPolicy === "once" ? "/1" : "";
  return { label: `Re-entered (${count}${denominator})`, tone: REENTRY_TONE };
}

// Derives per-player batted/fielded innings from data that already exists:
// fieldingByInning (per-inning fielding charts) for "fielded", and
// battingSlots' history (via occupantAtInning) for "batted". Only innings
// actually marked completed count - an inning that's merely open (tapped
// into but not yet finished) hasn't happened yet from a playtime-accounting
// standpoint, so it shouldn't count toward anyone's batted/fielded/sat-out
// totals until the coach explicitly completes it.
export function computeParticipation({ players, battingOrder, battingSlots, fieldingByInning, completedInnings }) {
  const participation = {};
  for (const p of players) {
    participation[p.id] = { battedInnings: new Set(), fieldedInnings: new Set() };
  }

  const completedInningsSorted = [...completedInnings].sort((a, b) => a - b);

  for (const inning of completedInningsSorted) {
    const chart = fieldingByInning[inning] || {};
    for (const playerId of Object.values(chart)) {
      if (participation[playerId]) participation[playerId].fieldedInnings.add(inning);
    }

    battingOrder.forEach((_, idx) => {
      const slot = battingSlots[idx];
      if (!slot) return;
      const occupant = occupantAtInning(slot, inning);
      if (occupant && participation[occupant]) {
        participation[occupant].battedInnings.add(inning);
      }
    });
  }

  return { participation, completedInningsSorted };
}

// Season-wide rollup of the same batted/fielded/sat-out accounting, summed
// across every game in the league rather than one game's innings. Reuses
// computeParticipation per game rather than re-deriving it, so the two never
// drift apart. satOutInnings mirrors the per-game formula (innings actually
// completed, league-wide, minus innings batted) extended additively across
// games - same semantics as the single-game Playtime report, just summed.
export function computeSeasonPlaytime(games, players) {
  const byPlayer = {};
  for (const p of players) {
    byPlayer[p.id] = { battedInnings: 0, fieldedInnings: 0, gamesPlayed: 0, games: [] };
  }

  let totalInningsCompleted = 0;
  let gamesWithData = 0;

  for (const game of games) {
    const completedInnings = game.completedInnings || [];
    if (completedInnings.length === 0) continue;
    gamesWithData += 1;

    const { participation, completedInningsSorted } = computeParticipation({
      players,
      battingOrder: game.battingOrder,
      battingSlots: game.battingSlots,
      fieldingByInning: game.fieldingByInning,
      completedInnings,
    });
    const inningsThisGame = completedInningsSorted.length;
    totalInningsCompleted += inningsThisGame;

    for (const p of players) {
      const stats = participation[p.id];
      const batted = stats ? stats.battedInnings.size : 0;
      const fielded = stats ? stats.fieldedInnings.size : 0;
      const entry = byPlayer[p.id];
      entry.battedInnings += batted;
      entry.fieldedInnings += fielded;
      if (batted > 0 || fielded > 0) entry.gamesPlayed += 1;
      entry.games.push({ gameId: game.id, date: game.date, opponent: game.opponent, batted, fielded, innings: inningsThisGame });
    }
  }

  const rows = players.map((p) => {
    const entry = byPlayer[p.id];
    return {
      playerId: p.id,
      gamesPlayed: entry.gamesPlayed,
      battedInnings: entry.battedInnings,
      fieldedInnings: entry.fieldedInnings,
      satOutInnings: Math.max(0, totalInningsCompleted - entry.battedInnings),
      games: entry.games,
    };
  });

  return { rows, totalInningsCompleted, gamesWithData };
}

// Season-wide pitching rollup: for every completed inning, whoever's
// fieldingByInning[inning].P was is credited with that inning pitched, and
// with however many runs the opponent scored that inning (game.scores.them,
// Section 3.3's per-inning score entry) - 0 if the coach completed the
// inning but never entered a score for it. Entirely derived from data that
// already exists (fielding charts + scores), same "derived, not separately
// logged" approach as computeSeasonPlaytime - there's no separate pitching
// entry form. An inning left unassigned (no one placed at P) contributes to
// no one's line.
export function computeSeasonPitching(games, players) {
  const byPlayer = {};
  for (const p of players) {
    byPlayer[p.id] = { inningsPitched: 0, runsAllowed: 0, gamesPitched: 0, games: [] };
  }

  for (const game of games) {
    const completedInnings = game.completedInnings || [];
    if (completedInnings.length === 0) continue;

    const them = (game.scores || {}).them || {};
    const perGamePitcher = {}; // playerId -> { innings, runs }

    for (const inning of completedInnings) {
      const pitcherId = (game.fieldingByInning[inning] || {}).P;
      if (!pitcherId || !byPlayer[pitcherId]) continue;
      const runs = Number(them[inning] ?? 0) || 0;
      const entry = (perGamePitcher[pitcherId] ||= { innings: 0, runs: 0 });
      entry.innings += 1;
      entry.runs += runs;
    }

    for (const [playerId, { innings, runs }] of Object.entries(perGamePitcher)) {
      const entry = byPlayer[playerId];
      entry.inningsPitched += innings;
      entry.runsAllowed += runs;
      entry.gamesPitched += 1;
      entry.games.push({ gameId: game.id, date: game.date, opponent: game.opponent, innings, runs });
    }
  }

  const rows = players
    .map((p) => {
      const entry = byPlayer[p.id];
      const ra5 = entry.inningsPitched > 0 ? (entry.runsAllowed / entry.inningsPitched) * 5 : null;
      return {
        playerId: p.id,
        gamesPitched: entry.gamesPitched,
        inningsPitched: entry.inningsPitched,
        runsAllowed: entry.runsAllowed,
        ra5,
        games: entry.games,
      };
    })
    .filter((r) => r.gamesPitched > 0);

  return { rows };
}

// Orders players the way a coach reads a lineup card: slot 0's starter,
// slot 1's starter, ... (the starting batting order, top to bottom), then
// anyone who subbed in later (ordered by the inning they first entered),
// then anyone who never appeared in this game's batting order at all (left
// in their existing relative order, since there's no game data to rank them
// by). A starter keeps their original slot's rank even after being subbed
// out and re-entering - re-entry doesn't change where they sit in the
// lineup. Shared by the Playtime report and Game stats entry so both read
// in the same order.
export function orderPlayersByStartingLineup(players, battingSlots) {
  const starterRank = new Map(); // playerId -> starting slot index
  const subEntryInning = new Map(); // playerId -> earliest inning they subbed in

  const slotIndexes = Object.keys(battingSlots)
    .map(Number)
    .sort((a, b) => a - b);
  for (const idx of slotIndexes) {
    const slot = battingSlots[idx];
    starterRank.set(slot.starterId, idx);
  }
  for (const idx of slotIndexes) {
    for (const event of battingSlots[idx].history) {
      if (event.eventType !== "substitute" || starterRank.has(event.playerId)) continue;
      const prevInning = subEntryInning.get(event.playerId);
      if (prevInning == null || event.inning < prevInning) subEntryInning.set(event.playerId, event.inning);
    }
  }

  function rank(playerId) {
    if (starterRank.has(playerId)) return [0, starterRank.get(playerId)];
    if (subEntryInning.has(playerId)) return [1, subEntryInning.get(playerId)];
    return [2, 0];
  }

  return players
    .map((p, originalIndex) => ({ p, originalIndex, rank: rank(p.id) }))
    .sort((a, b) => {
      if (a.rank[0] !== b.rank[0]) return a.rank[0] - b.rank[0];
      if (a.rank[1] !== b.rank[1]) return a.rank[1] - b.rank[1];
      return a.originalIndex - b.originalIndex;
    })
    .map((x) => x.p);
}
