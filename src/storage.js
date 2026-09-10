// Phase 7: Leagues -> Games persistence.
//
// Storage shape:
//   lineupApp.leagues            -> League[]              (metadata only: id, name, createdAt, updatedAt)
//   lineupApp.activeLeagueId     -> string | null          (last-opened league, so relaunching returns to it)
//   lineupApp.league.<leagueId>  -> LeagueData             (roster, settings, statLines, games, activeGameId - one blob)
//
// Before Phase 7, everything lived flat under lineupApp.<key> (players,
// battingOrder, fieldingByInning, etc.) as a single implicit "current game".
// migrateLegacyDataIfNeeded() wraps that old flat state into one League +
// one Game, once, the first time the app loads after this upgrade.

import { uid } from "./constants";

const STORAGE_PREFIX = "lineupApp.";
const LEGACY_KEYS = [
  "players", "battingOrder", "battingOrderSize", "gameStarted", "startingAssignments",
  "battingSlots", "defaultLeagueSettings", "statLines", "activeGameId", "activeGameDate",
  "activeInning", "fieldingByInning", "completedInnings",
];

export function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLS(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage can throw if full or disabled (e.g. private browsing) -
    // fail silently rather than crash the app.
  }
}

function removeLS(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

export function readLeagues() {
  return readLS("leagues", []);
}

export function writeLeagues(leagues) {
  writeLS("leagues", leagues);
}

export function readActiveLeagueId() {
  return readLS("activeLeagueId", null);
}

export function writeActiveLeagueId(id) {
  writeLS("activeLeagueId", id);
}

export function defaultLeagueData() {
  return {
    roster: [],
    defaultLeagueSettings: { reEntryPolicy: "once" },
    statLines: [],
    games: [],
    activeGameId: null,
  };
}

export function readLeagueData(leagueId) {
  return readLS(`league.${leagueId}`, defaultLeagueData());
}

export function writeLeagueData(leagueId, data) {
  writeLS(`league.${leagueId}`, data);
}

export function deleteLeagueData(leagueId) {
  removeLS(`league.${leagueId}`);
}

// A fresh Game object. leagueSettings is copied from the league's default at
// creation time and is independently editable per game until it locks
// (architecture doc Section 7 / Decision 28).
export function defaultGame({ opponent = "", date = "", time = "", leagueSettings }) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    opponent,
    date,
    time,
    createdAt: now,
    updatedAt: now,
    leagueSettings: { ...leagueSettings },
    battingOrder: [],
    battingOrderSize: 10,
    gameStarted: false,
    startingAssignments: {},
    battingSlots: {},
    activeInning: 1,
    fieldingByInning: { 1: {} },
    completedInnings: [],
    scores: { us: {}, them: {} },
  };
}

// Wraps a set of old flat lineupApp.<key> values into one League + one Game.
// Pure - callers write the result; kept separate from
// migrateLegacyDataIfNeeded so backup.js can reuse it for importing a v1
// (pre-League) backup file.
export function wrapLegacyStateAsLeague(flat) {
  const now = new Date().toISOString();
  const gameId = flat.activeGameId || uid();
  const defaultLeagueSettings = flat.defaultLeagueSettings || { reEntryPolicy: "once" };
  const game = {
    id: gameId,
    opponent: "",
    date: flat.activeGameDate || "",
    time: "",
    createdAt: now,
    updatedAt: now,
    leagueSettings: { ...defaultLeagueSettings },
    battingOrder: flat.battingOrder || [],
    battingOrderSize: flat.battingOrderSize ?? 10,
    gameStarted: !!flat.gameStarted,
    startingAssignments: flat.startingAssignments || {},
    battingSlots: flat.battingSlots || {},
    activeInning: flat.activeInning ?? 1,
    fieldingByInning: flat.fieldingByInning || { 1: {} },
    completedInnings: flat.completedInnings || [],
  };
  const hasAnyGameData =
    game.battingOrder.length > 0 || Object.keys(game.battingSlots).length > 0 ||
    Object.values(game.fieldingByInning).some((chart) => Object.keys(chart).length > 0);
  const league = { id: uid(), name: "My League", createdAt: now, updatedAt: now };
  const leagueData = {
    roster: flat.players || [],
    defaultLeagueSettings,
    statLines: (flat.statLines || []).map((l) => ({ ...l, gameId: l.gameId || gameId })),
    games: hasAnyGameData ? [game] : [],
    activeGameId: hasAnyGameData ? gameId : null,
  };
  return { league, leagueData };
}

// Runs once, before the app's first read of `leagues`. If the new nested
// shape already exists, this is a no-op. Otherwise, if the old flat keys
// exist, wraps them into a first League so nothing already saved is lost;
// if neither exists, this is a brand-new install and just seeds an empty
// leagues list. Wrapped in try/catch - if anything looks malformed, fall
// back to starting empty rather than throwing.
export function migrateLegacyDataIfNeeded() {
  try {
    if (localStorage.getItem(STORAGE_PREFIX + "leagues") != null) return;

    const hasLegacy = localStorage.getItem(STORAGE_PREFIX + "players") != null;
    if (!hasLegacy) {
      writeLeagues([]);
      return;
    }

    const flat = {};
    for (const key of LEGACY_KEYS) flat[key] = readLS(key, undefined);

    const { league, leagueData } = wrapLegacyStateAsLeague(flat);
    writeLeagues([league]);
    writeLeagueData(league.id, leagueData);
    writeActiveLeagueId(league.id);

    for (const key of LEGACY_KEYS) removeLS(key);
  } catch {
    // Best effort - if migration fails, leave existing keys alone rather
    // than risk deleting data we couldn't successfully move.
  }
}
