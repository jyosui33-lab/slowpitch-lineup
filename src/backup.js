// Phase 6: export/import backup (Section 3.4), updated for Phase 7's
// Leagues -> Games hierarchy.
//
// Mitigates iOS Safari's ~7-day localStorage eviction risk for a seasonal
// app by letting the coach manually snapshot the whole app (every league)
// to a JSON file and restore it later - on the same phone after a cache
// clear, or on a new one. There's no backend, so this file *is* the sync
// mechanism.

import { wrapLegacyStateAsLeague } from "./storage";

export const BACKUP_VERSION = 2;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Per-game fields, mirroring storage.js's defaultGame() shape. Anything
// missing or malformed on import falls back to its own default rather than
// failing the whole restore (Decision 44), so a backup from an older/newer
// version of the app still imports the parts that still make sense.
const GAME_FIELDS = [
  { key: "opponent", defaultValue: "", validate: (v) => typeof v === "string" },
  { key: "date", defaultValue: "", validate: (v) => typeof v === "string" },
  { key: "time", defaultValue: "", validate: (v) => typeof v === "string" },
  { key: "createdAt", defaultValue: "", validate: (v) => typeof v === "string" },
  { key: "updatedAt", defaultValue: "", validate: (v) => typeof v === "string" },
  { key: "leagueSettings", defaultValue: { reEntryPolicy: "once" }, validate: isPlainObject },
  { key: "battingOrder", defaultValue: [], validate: Array.isArray },
  { key: "battingOrderSize", defaultValue: 10, validate: (v) => typeof v === "number" },
  { key: "gameStarted", defaultValue: false, validate: (v) => typeof v === "boolean" },
  { key: "startingAssignments", defaultValue: {}, validate: isPlainObject },
  { key: "battingSlots", defaultValue: {}, validate: isPlainObject },
  { key: "activeInning", defaultValue: 1, validate: (v) => typeof v === "number" },
  { key: "fieldingByInning", defaultValue: { 1: {} }, validate: isPlainObject },
  { key: "completedInnings", defaultValue: [], validate: Array.isArray },
  { key: "scores", defaultValue: { us: {}, them: {} }, validate: isPlainObject },
];

function sanitizeGame(raw) {
  if (!isPlainObject(raw) || typeof raw.id !== "string") return null;
  const game = { id: raw.id };
  for (const { key, defaultValue, validate } of GAME_FIELDS) {
    const value = raw[key];
    game[key] = value !== undefined && validate(value) ? value : defaultValue;
  }
  return game;
}

const LEAGUE_DATA_FIELDS = [
  { key: "roster", defaultValue: [], validate: Array.isArray },
  { key: "defaultLeagueSettings", defaultValue: { reEntryPolicy: "once" }, validate: isPlainObject },
  { key: "statLines", defaultValue: [], validate: Array.isArray },
  { key: "activeGameId", defaultValue: null, validate: () => true },
];

function sanitizeLeagueData(raw) {
  const data = {};
  for (const { key, defaultValue, validate } of LEAGUE_DATA_FIELDS) {
    const value = raw?.[key];
    data[key] = value !== undefined && validate(value) ? value : defaultValue;
  }
  const rawGames = Array.isArray(raw?.games) ? raw.games : [];
  data.games = rawGames.map(sanitizeGame).filter(Boolean);
  return data;
}

// `state` is { leagues, leagueData } - see storage.js.
export function buildBackup(state) {
  return {
    app: "slowpitch-lineup-builder",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { leagues: state.leagues, leagueData: state.leagueData },
  };
}

export function backupFilename(date = new Date()) {
  return `lineup-backup-${date.toISOString().slice(0, 10)}.json`;
}

// Parses and validates a backup file's text. Returns
// { ok: true, data: { leagues, leagueData }, exportedAt } or
// { ok: false, error }. Rejects only what isn't recognizable as a backup of
// this app at all (bad JSON, no `data` object) - individual fields degrade
// gracefully to their defaults instead.
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isPlainObject(parsed) || !isPlainObject(parsed.data)) {
    return { ok: false, error: "That doesn't look like a lineup builder backup file." };
  }

  const exportedAt = typeof parsed.exportedAt === "string" ? parsed.exportedAt : null;

  // v1 backups (taken during Phases 1-6, before Leagues existed) held one
  // flat game's worth of state directly in `data` - wrap it into a single
  // League, the same way an old localStorage upgrade does, so those backups
  // still restore correctly into the new structure.
  if (parsed.version !== 2) {
    const { league, leagueData } = wrapLegacyStateAsLeague(parsed.data || {});
    return { ok: true, data: { leagues: [league], leagueData: { [league.id]: sanitizeLeagueData(leagueData) } }, exportedAt };
  }

  const rawLeagues = Array.isArray(parsed.data.leagues) ? parsed.data.leagues : [];
  const leagues = rawLeagues
    .filter((l) => isPlainObject(l) && typeof l.id === "string" && typeof l.name === "string")
    .map((l) => ({
      id: l.id,
      name: l.name,
      teamName: typeof l.teamName === "string" ? l.teamName : "",
      createdAt: l.createdAt || "",
      updatedAt: l.updatedAt || "",
    }));

  const rawLeagueData = isPlainObject(parsed.data.leagueData) ? parsed.data.leagueData : {};
  const leagueData = {};
  for (const l of leagues) leagueData[l.id] = sanitizeLeagueData(rawLeagueData[l.id]);

  return { ok: true, data: { leagues, leagueData }, exportedAt };
}
