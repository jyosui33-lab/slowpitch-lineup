// Roster CRUD, extracted from the original single-file App.jsx (Phase 1-6
// behavior unchanged). Rendered from both the League workspace (manage the
// roster between games) and the Game workspace (add a late player mid-game)
// against the same lifted `players` state - deletion cascades across every
// game in the league, so `onDeletePlayer` is always supplied by the caller
// rather than this component mutating `players` directly for deletes.

import { useState, Fragment } from "react";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { COLORS, POSITIONS, uid, initials } from "./constants";
import { CollapsibleCard } from "./ui";

export default function RosterCard({ players, setPlayers, onDeletePlayer, defaultOpen = false, teamName }) {
  const [rosterOpen, setRosterOpen] = useState(defaultOpen);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formJersey, setFormJersey] = useState("");
  const [formPositions, setFormPositions] = useState([]);
  const [formError, setFormError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function resetForm() {
    setFormName("");
    setFormJersey("");
    setFormPositions([]);
    setEditingId(null);
    setFormError("");
  }

  function openAddForm() {
    resetForm();
    setRosterOpen(true);
    setFormOpen(true);
  }

  function openEditForm(player) {
    setFormName(player.name);
    setFormJersey(player.jerseyNumber);
    setFormPositions(player.eligiblePositions);
    setEditingId(player.id);
    setFormError("");
    setFormOpen(true);
  }

  function togglePosition(posId) {
    setFormPositions((prev) => (prev.includes(posId) ? prev.filter((p) => p !== posId) : [...prev, posId]));
  }

  function submitForm(e) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Enter a name.");
      return;
    }
    if (formPositions.length === 0) {
      setFormError("Select at least one eligible position.");
      return;
    }
    if (editingId) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, name: formName.trim(), jerseyNumber: formJersey.trim(), eligiblePositions: formPositions }
            : p
        )
      );
    } else {
      setPlayers((prev) => [
        ...prev,
        { id: uid(), name: formName.trim(), jerseyNumber: formJersey.trim(), eligiblePositions: formPositions },
      ]);
    }
    setFormOpen(false);
    resetForm();
  }

  function deletePlayer(id) {
    onDeletePlayer(id);
    setConfirmDeleteId(null);
  }

  function renderPlayerForm() {
    return (
      <form
        onSubmit={submitForm}
        style={{ background: COLORS.chalk, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Player name"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
          />
          <input
            value={formJersey}
            onChange={(e) => setFormJersey(e.target.value)}
            placeholder="#"
            inputMode="numeric"
            style={{ width: 64, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 6 }}>Eligible positions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {POSITIONS.map((pos) => {
              const active = formPositions.includes(pos.id);
              return (
                <button
                  type="button"
                  key={pos.id}
                  className="lb-btn"
                  onClick={() => togglePosition(pos.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? COLORS.turf : COLORS.border}`,
                    background: active ? COLORS.turf : "#fff",
                    color: active ? "#fff" : COLORS.ink,
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 44,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {active && <Check size={12} />} {pos.id}
                </button>
              );
            })}
          </div>
        </div>
        {formError && <div style={{ fontSize: 13, color: COLORS.danger, fontWeight: 600 }}>{formError}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            className="lb-btn"
            style={{ flex: 1, background: COLORS.turf, color: "#fff", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700 }}
          >
            {editingId ? "Save changes" : "Add to roster"}
          </button>
          <button
            type="button"
            className="lb-btn"
            onClick={() => {
              setFormOpen(false);
              resetForm();
            }}
            style={{ padding: "10px 16px", background: "transparent", color: COLORS.inkSoft, fontWeight: 600, fontSize: 14 }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
      <CollapsibleCard
        title={teamName?.trim() ? `${teamName.trim()} roster` : "Roster"}
        subtitle={`${players.length} player${players.length === 1 ? "" : "s"}`}
        open={rosterOpen}
        onToggle={() => setRosterOpen((v) => !v)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {players.length === 0 && (
            <div style={{ fontSize: 13, color: COLORS.muted }}>No players yet — add your first one below.</div>
          )}
          {players.map((p) => (
            <Fragment key={p.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: COLORS.turf,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {initials(p.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    #{p.jerseyNumber || "–"} · {p.eligiblePositions.join(", ")}
                  </div>
                </div>
                <button
                  className="lb-btn"
                  onClick={() => openEditForm(p)}
                  style={{ padding: 8, background: "transparent", color: COLORS.ink }}
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil size={16} />
                </button>
                {confirmDeleteId === p.id ? (
                  <button
                    className="lb-btn"
                    onClick={() => deletePlayer(p.id)}
                    style={{ padding: "6px 10px", background: COLORS.danger, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    className="lb-btn"
                    onClick={() => setConfirmDeleteId(p.id)}
                    style={{ padding: 8, background: "transparent", color: COLORS.danger }}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {formOpen && editingId === p.id && renderPlayerForm()}
            </Fragment>
          ))}
        </div>

        {!formOpen ? (
          <button
            className="lb-btn"
            onClick={openAddForm}
            style={{
              width: "100%",
              background: COLORS.ink,
              color: COLORS.chalk,
              borderRadius: 10,
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Plus size={16} /> Add player
          </button>
        ) : (
          !editingId && renderPlayerForm()
        )}
      </CollapsibleCard>
    </section>
  );
}
