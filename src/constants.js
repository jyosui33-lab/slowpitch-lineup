// Shared constants and small pure helpers used across League/Game screens.

export const POSITIONS = [
  { id: "P", label: "Pitcher", x: 190, y: 260 },
  { id: "C", label: "Catcher", x: 190, y: 393 },
  { id: "1B", label: "First base", x: 297.5, y: 237.5 },
  { id: "2B", label: "Second base", x: 235, y: 190 },
  { id: "3B", label: "Third base", x: 82.5, y: 237.5 },
  { id: "SS", label: "Shortstop", x: 145, y: 190 },
  { id: "LF", label: "Left field", x: 40.1, y: 138.7 },
  { id: "LC", label: "Left center", x: 132.7, y: 85 },
  { id: "RC", label: "Right center", x: 247.3, y: 85 },
  { id: "RF", label: "Right field", x: 339.9, y: 138.7 },
];

// Extra Player (EP) spots: batters beyond the 10 fielders who bat but don't
// play defense. Shown as tap-to-place slots in the field's bottom-left
// corner, same interaction as the 10 defensive positions, but open to any
// batting-order player regardless of eligiblePositions (Decision 21).
export const EP_SLOTS = [
  { id: "EP1", label: "Extra player 1", x: 45, y: 360 },
  { id: "EP2", label: "Extra player 2", x: 95, y: 360 },
  { id: "EP3", label: "Extra player 3", x: 45, y: 410 },
  { id: "EP4", label: "Extra player 4", x: 95, y: 410 },
];

// Infield geometry: a true right-angle diamond, home plate at the bottom
// vertex with its point touching that vertex and its flat edge toward the
// pitcher, and small diamond-shaped bases at 1st, 2nd, and 3rd.
export const HOME = { x: 190, y: 345 };
export const BASE_1B = { x: 281.9, y: 253.1 };
export const BASE_2B = { x: 190, y: 161.2 };
export const BASE_3B = { x: 98.1, y: 253.1 };
// The foul lines run the full 45 degrees out to the card's side edges, where
// they meet the ends of the outfield fence arc.
export const FOUL_LINE_RIGHT_END = { x: 380, y: 155 };
export const FOUL_LINE_LEFT_END = { x: 0, y: 155 };

export function baseMarkerPath(cx, cy, half = 8) {
  return `M${cx},${cy - half} L${cx + half},${cy} L${cx},${cy + half} L${cx - half},${cy} Z`;
}

export const BASE_DIAMOND_PATH =
  `M${HOME.x},${HOME.y} L${BASE_1B.x},${BASE_1B.y} L${BASE_2B.x},${BASE_2B.y} L${BASE_3B.x},${BASE_3B.y} Z`;

// Infield dirt "skin": the fan the infielders stand on. Bounded by the
// 3B-2B-1B base lines on the inside, the two foul lines at its ends, and an
// arc of radius 130 centered on the pitcher's circle (190, 260) - the way a
// real infield skin is struck, which also gives it the same curvature as the
// fence arc. The middle of the diamond stays grass.
export const INFIELD_SKIN_PATH =
  "M98.1,253.1 L66,221 A130,130 0 0 1 314,221 L281.9,253.1 L190,161.2 Z";

// Outfield fence: an arc through the two points where the foul lines exit the
// card's side edges, bulging out to y=20 at center. Deeper to center than
// down the lines (like a real 330-down-the-line / 400-to-center fence), so it
// also clears the outfielders' markers instead of cutting through them.
export const FENCE_ARC_PATH = "M0,155 A201,201 0 0 1 380,155";

export const INNINGS = [1, 2, 3, 4, 5, 6, 7];

export const COLORS = {
  ink: "#1E2A28",
  inkSoft: "#3A4744",
  cream: "#F6F2E7",
  card: "#FFFFFF",
  turf: "#4C7A46",
  turfDark: "#3A5F37",
  turfLight: "#5C8F52",
  clay: "#C97F4A",
  dirtLight: "#E09A62",
  chalk: "#F4EFDF",
  gold: "#D6A23A",
  goldDeep: "#9C6E1F",
  danger: "#B7442F",
  dangerBg: "#F7E2DC",
  muted: "#8A9490",
  border: "#E4DCC8",
  epBlue: "#4F8FC4",
  epBluePale: "#E3F1FA",
  epBlueBorder: "#8FC7E8",
};

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

export function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// teamName is optional: leagues created before team names existed simply
// read "vs. Riverside" as they always did.
export function gameLabel(game, teamName) {
  const opp = game.opponent?.trim() || "TBD";
  const us = teamName?.trim();
  const datePart = formatDate(game.date);
  const timePart = formatTime(game.time);
  const matchup = us ? `${us} vs. ${opp}` : `vs. ${opp}`;
  return `${matchup}${datePart ? ` — ${datePart}` : ""}${timePart ? ` ${timePart}` : ""}`;
}

export function isGameOver(game) {
  return !game.gameStarted && Object.keys(game.battingSlots).length > 0;
}

export function emptyScores() {
  return { us: {}, them: {} };
}

// Runs per inning are stored sparsely ({ 3: 2 } = two runs in the 3rd), so a
// not-yet-played inning stays blank on the scoreboard rather than showing a
// 0 nobody entered. Games created before scores existed have none at all.
export function gameScoreSummary(game) {
  const scores = game.scores || emptyScores();
  const sideTotal = (side) => Object.values(side || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const anyEntered = Object.keys(scores.us || {}).length > 0 || Object.keys(scores.them || {}).length > 0;
  const us = sideTotal(scores.us);
  const them = sideTotal(scores.them);
  return {
    hasScores: anyEntered,
    us,
    them,
    result: us > them ? "W" : us < them ? "L" : "T",
  };
}
