// Phase 7: the app's home screen - list/create/rename/delete Leagues
// (season-length containers, each with their own roster/games/stats).
// Also hosts the Backup card (moved here from the per-game screen, Phase
// 6), since a backup should snapshot every league at once, not just one.

import { useState, useRef } from "react";
import { Plus, Trash2, Pencil, Check, ChevronRight, Download, Upload } from "lucide-react";
import { COLORS, uid } from "./constants";
import { readLeagueData, writeLeagueData } from "./storage";
import { buildBackup, backupFilename, parseBackup } from "./backup";
import { TopHeader } from "./ui";

export default function LeagueMenu({ leagues, setLeagues, onOpenLeague }) {
  const [formOpen, setFormOpen] = useState(leagues.length === 0);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [importError, setImportError] = useState("");
  const [justExported, setJustExported] = useState(false);
  const fileInputRef = useRef(null);

  function createLeague(e) {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError("Enter a league or season name.");
      return;
    }
    if (!teamName.trim()) {
      setCreateError("Enter the name of the team you play for.");
      return;
    }
    const now = new Date().toISOString();
    const league = { id: uid(), name: name.trim(), teamName: teamName.trim(), createdAt: now, updatedAt: now };
    setLeagues((prev) => [...prev, league]);
    setName("");
    setTeamName("");
    setCreateError("");
    setFormOpen(false);
    onOpenLeague(league.id);
  }

  function startRename(l) {
    setEditingId(l.id);
    setEditName(l.name);
  }

  function saveRename(id) {
    const trimmed = editName.trim();
    setLeagues((prev) => prev.map((l) => (l.id === id ? { ...l, name: trimmed || l.name, updatedAt: new Date().toISOString() } : l)));
    setEditingId(null);
  }

  function deleteLeague(id) {
    setLeagues((prev) => prev.filter((l) => l.id !== id));
    // League data itself (roster/games/stats) is left in localStorage under
    // its own key rather than actively scrubbed here - harmless orphaned
    // data, and simpler/safer than risking a delete race with an in-flight
    // write from a still-mounted workspace.
    setConfirmDeleteId(null);
  }

  function exportBackup() {
    const leagueData = {};
    for (const l of leagues) leagueData[l.id] = readLeagueData(l.id);
    const backup = buildBackup({ leagues, leagueData });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setJustExported(true);
    setTimeout(() => setJustExported(false), 2000);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setPendingImport(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseBackup(String(reader.result));
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setPendingImport(result);
    };
    reader.onerror = () => setImportError("Couldn't read that file.");
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImport) return;
    const { leagues: importedLeagues, leagueData } = pendingImport.data;
    for (const l of importedLeagues) writeLeagueData(l.id, leagueData[l.id]);
    setLeagues(importedLeagues);
    setPendingImport(null);
  }

  function cancelImport() {
    setPendingImport(null);
  }

  const totalPlayers = pendingImport ? pendingImport.data.leagues.reduce((sum, l) => sum + (pendingImport.data.leagueData[l.id]?.roster.length || 0), 0) : 0;
  const totalStatLines = pendingImport ? pendingImport.data.leagues.reduce((sum, l) => sum + (pendingImport.data.leagueData[l.id]?.statLines.length || 0), 0) : 0;

  return (
    <div style={{ paddingBottom: 32 }}>
      <TopHeader title="Leagues" subtitle="Pick a league to open, or start a new one." />

      <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
        <div style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Your leagues</h2>
            {!formOpen && (
              <button
                type="button"
                className="lb-btn"
                onClick={() => setFormOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.ink, color: COLORS.chalk, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700 }}
              >
                <Plus size={14} /> New league
              </button>
            )}
          </div>

          {formOpen && (
            <form onSubmit={createLeague} style={{ background: COLORS.chalk, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="League or season name (e.g. Tuesday Coed Spring 2026)"
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
              />
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Your team's name (e.g. Sandlot Sluggers)"
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
              />
              {createError && <div style={{ fontSize: 13, color: COLORS.danger, fontWeight: 600 }}>{createError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="lb-btn" style={{ flex: 1, background: COLORS.turf, color: "#fff", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700 }}>
                  Create
                </button>
                {leagues.length > 0 && (
                  <button
                    type="button"
                    className="lb-btn"
                    onClick={() => {
                      setFormOpen(false);
                      setName("");
                      setTeamName("");
                      setCreateError("");
                    }}
                    style={{ padding: "10px 16px", background: "transparent", color: COLORS.inkSoft, fontWeight: 600, fontSize: 14 }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {leagues.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.muted }}>No leagues yet — create your first one above.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {leagues.map((l) => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 10px" }}>
                  {editingId === l.id ? (
                    <>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRename(l.id)}
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
                      />
                      <button className="lb-btn" onClick={() => saveRename(l.id)} style={{ padding: 8, background: "transparent", color: COLORS.turf }} aria-label="Save name">
                        <Check size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="lb-btn"
                        onClick={() => onOpenLeague(l.id)}
                        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", display: "flex", flexDirection: "column", gap: 2 }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                        {l.teamName && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {l.teamName}
                          </span>
                        )}
                      </button>
                      <button className="lb-btn" onClick={() => onOpenLeague(l.id)} style={{ padding: 8, background: "transparent", color: COLORS.muted }} aria-label={`Open ${l.name}`}>
                        <ChevronRight size={18} />
                      </button>
                      <button className="lb-btn" onClick={() => startRename(l)} style={{ padding: 8, background: "transparent", color: COLORS.ink }} aria-label={`Rename ${l.name}`}>
                        <Pencil size={16} />
                      </button>
                      {confirmDeleteId === l.id ? (
                        <button
                          className="lb-btn"
                          onClick={() => deleteLeague(l.id)}
                          style={{ padding: "6px 10px", background: COLORS.danger, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                        >
                          Confirm
                        </button>
                      ) : (
                        <button className="lb-btn" onClick={() => setConfirmDeleteId(l.id)} style={{ padding: 8, background: "transparent", color: COLORS.danger }} aria-label={`Delete ${l.name}`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Backup export/import (Section 3.4), now covering every league */}
      <section className="lb-page-inner" style={{ padding: "12px 16px 4px" }}>
        <div style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <button
            className="lb-btn"
            onClick={() => setBackupOpen((v) => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px", background: "transparent", textAlign: "left" }}
          >
            <span style={{ fontSize: 16, fontWeight: 700 }}>Backup</span>
          </button>
          {backupOpen && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 12 }}>
                Everything is saved only in this browser. If it's cleared (iOS Safari can do this after about a week of
                not opening the site) every league's roster, games, and stats go with it — download a backup regularly,
                and after big changes like finishing a season.
              </div>

              <button
                type="button"
                className="lb-btn"
                onClick={exportBackup}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: COLORS.turf, color: "#fff", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, marginBottom: 8 }}
              >
                <Download size={16} /> {justExported ? "Downloaded!" : "Download backup"}
              </button>

              <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />
              <button
                type="button"
                className="lb-btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.ink, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700 }}
              >
                <Upload size={16} /> Restore from backup file
              </button>

              {importError && <div style={{ marginTop: 8, fontSize: 13, color: COLORS.danger, fontWeight: 600 }}>{importError}</div>}

              {pendingImport && (
                <div style={{ marginTop: 10, padding: 12, background: COLORS.dangerBg, borderRadius: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: COLORS.danger, marginBottom: 4 }}>Replace everything with this backup?</div>
                  <div style={{ color: COLORS.inkSoft, marginBottom: 10 }}>
                    {pendingImport.data.leagues.length} league{pendingImport.data.leagues.length === 1 ? "" : "s"}, {totalPlayers} player
                    {totalPlayers === 1 ? "" : "s"}, {totalStatLines} stat line{totalStatLines === 1 ? "" : "s"}
                    {pendingImport.exportedAt ? ` — exported ${pendingImport.exportedAt.slice(0, 10)}` : ""}. This replaces every league
                    currently in this browser and can't be undone.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="lb-btn"
                      onClick={confirmImport}
                      style={{ flex: 1, background: COLORS.danger, color: "#fff", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700 }}
                    >
                      Replace everything
                    </button>
                    <button type="button" className="lb-btn" onClick={cancelImport} style={{ padding: "9px 16px", background: "transparent", color: COLORS.inkSoft, fontWeight: 600, fontSize: 13 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
