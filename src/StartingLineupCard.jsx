// The shareable starting-lineup card: a compact, group-chat-friendly image
// (exported as a single-page PDF sized to fit it, via print.js's
// downloadCardPdf) generated once a game starts. Styled after a stadium
// "starting lineup" graphic - stacked two-tone title banner, alternating
// gray rows with a slanted batting-order numeral. Deliberately separate
// from PrintableLineupCard - that one is a multi-page coach's reference
// (full fielding chart + playtime report); this one is just "who's starting
// where," frozen at the moment Start game was hit rather than tracking live
// substitutions, since that's the version worth posting to the team.
import { forwardRef } from "react";
import { COLORS, formatDate, formatTime } from "./constants";

// Rows read as paper, not as a dark graphic: a light/dark gray pair keeps the
// names legible at phone size and in print, with the numeral block carrying
// the contrast instead of the whole row.
const ROW_COLORS = ["#F0EFEB", "#D7D5CE"];

// One gutter for every band on the card - header, title, rows, substitutes.
// Wide enough to pull the names and positions toward the center (the card is
// mostly read shrunk down in a group chat), and the point past which longer
// names would start truncating at the 18px row size.
const GUTTER = 36;

const StartingLineupCard = forwardRef(function StartingLineupCard({ game, players, teamName }, ref) {
  const { battingOrder, startingAssignments, opponent, date, time } = game;
  const playerById = (id) => players.find((p) => p.id === id);
  const starters = battingOrder.map((id) => playerById(id)).filter(Boolean);
  const subs = players.filter((p) => !battingOrder.includes(p.id));
  const dateLabel = [formatDate(date), formatTime(time)].filter(Boolean).join(" · ");
  const teamLabel = teamName?.trim() || "Our Team";

  // Name and jersey are one unit in both lists, so a sub reads the same way a
  // starter does; only the batting numeral and position are withheld.
  const nameStyle = {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 800,
    color: COLORS.ink,
    textTransform: "uppercase",
    letterSpacing: "0.01em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const jerseyStyle = { color: COLORS.inkSoft, fontWeight: 700 };

  return (
    <div ref={ref} style={{ width: 480, background: COLORS.chalk, fontFamily: "-apple-system, system-ui, sans-serif", color: COLORS.ink }}>
      {/* Header: matchup only - a short band so the type can carry it */}
      <div style={{ background: COLORS.ink, padding: `16px ${GUTTER}px 14px`, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.chalk, letterSpacing: "-0.015em", lineHeight: 1.1 }}>{teamLabel}</div>
        <div style={{ fontSize: 18, color: COLORS.gold, fontWeight: 800, marginTop: 3, lineHeight: 1.2 }}>vs. {opponent?.trim() || "TBD"}</div>
        {dateLabel && <div style={{ fontSize: 13, color: "#B9C2BE", fontWeight: 600, marginTop: 3 }}>{dateLabel}</div>}
      </div>

      {/* Stacked two-tone title banner */}
      <div style={{ padding: `18px ${GUTTER}px 0` }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.turfDark, letterSpacing: "0.02em", lineHeight: 1 }}>STARTING</div>
        <div
          style={{
            background: COLORS.ink,
            color: "#fff",
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: "-0.01em",
            lineHeight: 1.05,
            padding: "4px 10px",
            marginTop: 2,
          }}
        >
          LINEUP
        </div>
      </div>

      {/* Alternating rows: batting order, name, position */}
      <div style={{ padding: `10px ${GUTTER}px 0` }}>
        {starters.map((p, i) => {
          const rowColor = ROW_COLORS[i % 2];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "stretch", background: rowColor, marginBottom: 3 }}>
              <div
                style={{
                  width: 40,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: COLORS.ink,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, fontStyle: "italic", color: "#fff" }}>{i + 1}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", padding: "11px 16px" }}>
                <span style={nameStyle}>
                  {p.name} <span style={jerseyStyle}>#{p.jerseyNumber || "–"}</span>
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: COLORS.turfDark, flexShrink: 0, marginLeft: 8 }}>
                  {startingAssignments[p.id] || "Bench"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Substitutes: boxed off and set at starter size, but without a batting
          numeral or position - they haven't been assigned either yet. */}
      <div style={{ padding: subs.length > 0 ? `16px ${GUTTER}px 24px` : `8px ${GUTTER}px 24px` }}>
        {subs.length > 0 && (
          <div style={{ border: `2px solid ${COLORS.ink}`, background: COLORS.card }}>
            <div
              style={{
                background: COLORS.ink,
                color: COLORS.chalk,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.1em",
                padding: "6px 12px",
              }}
            >
              SUBSTITUTES
            </div>
            <div style={{ padding: 8 }}>
              {subs.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: ROW_COLORS[i % 2],
                    padding: "9px 16px",
                    marginBottom: i === subs.length - 1 ? 0 : 3,
                  }}
                >
                  <span style={nameStyle}>
                    {p.name} <span style={jerseyStyle}>#{p.jerseyNumber || "–"}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default StartingLineupCard;
