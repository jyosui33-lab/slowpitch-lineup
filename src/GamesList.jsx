// Phase 7: per-league Games list + "New game" form (Section 7 of the
// architecture doc). A game is created with structured date/time/opponent
// fields rather than the old free-text name; the display label is derived
// (see gameLabel in constants.js).

import { useState } from "react";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { COLORS, gameLabel, isGameOver, gameScoreSummary } from "./constants";

function gameStatus(game) {
  if (isGameOver(game)) return { label: "Completed", color: COLORS.muted };
  if (game.gameStarted) return { label: "In progress", color: COLORS.turf };
  return { label: "Not started", color: COLORS.goldDeep };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function GamesList({ games, onCreate, onOpen, onDelete, teamName }) {
  const [formOpen, setFormOpen] = useState(games.length === 0);
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!opponent.trim()) {
      setError("Enter an opponent.");
      return;
    }
    onCreate({ opponent: opponent.trim(), date, time });
    setOpponent("");
    setTime("");
    setDate(today());
    setError("");
    setFormOpen(false);
  }

  const sorted = [...games].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  return (
    <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
      <div style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Games</h2>
          {!formOpen && (
            <button
              type="button"
              className="lb-btn"
              onClick={() => setFormOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: COLORS.ink,
                color: COLORS.chalk,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Plus size={14} /> New game
            </button>
          )}
        </div>

        {formOpen && (
          <form
            onSubmit={submit}
            style={{ background: COLORS.chalk, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}
          >
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Opponent"
              style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
              />
            </div>
            {error && <div style={{ fontSize: 13, color: COLORS.danger, fontWeight: 600 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                className="lb-btn"
                style={{ flex: 1, background: COLORS.turf, color: "#fff", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700 }}
              >
                Create game
              </button>
              {games.length > 0 && (
                <button
                  type="button"
                  className="lb-btn"
                  onClick={() => {
                    setFormOpen(false);
                    setError("");
                  }}
                  style={{ padding: "10px 16px", background: "transparent", color: COLORS.inkSoft, fontWeight: 600, fontSize: 14 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {sorted.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>No games yet — create your first one above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sorted.map((g) => {
              const status = gameStatus(g);
              const score = gameScoreSummary(g);
              const scoreTone = score.result === "W" ? COLORS.turf : score.result === "L" ? COLORS.danger : COLORS.goldDeep;
              return (
                <div
                  key={g.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 10px" }}
                >
                  <button
                    className="lb-btn"
                    onClick={() => onOpen(g.id)}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {gameLabel(g, teamName)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: status.color }}>{status.label}</span>
                      {score.hasScores && (
                        <>
                          <span style={{ color: COLORS.border }}>•</span>
                          <span style={{ color: scoreTone }}>
                            {score.result} {score.us}–{score.them}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                  <button
                    className="lb-btn"
                    onClick={() => onOpen(g.id)}
                    style={{ padding: 8, background: "transparent", color: COLORS.muted }}
                    aria-label="Open game"
                  >
                    <ChevronRight size={18} />
                  </button>
                  {confirmDeleteId === g.id ? (
                    <button
                      className="lb-btn"
                      onClick={() => {
                        onDelete(g.id);
                        setConfirmDeleteId(null);
                      }}
                      style={{ padding: "6px 10px", background: COLORS.danger, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      className="lb-btn"
                      onClick={() => setConfirmDeleteId(g.id)}
                      style={{ padding: 8, background: "transparent", color: COLORS.danger }}
                      aria-label={`Delete game vs ${g.opponent}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
