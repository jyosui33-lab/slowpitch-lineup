// The per-game workspace: inning tabs, fielding diamond, batting order
// builder, playtime report, and post-game stats entry. Extracted from the
// original single-file App.jsx (Phases 1-6, unchanged behavior) - the ~13
// flat useState hooks that used to hold "the current game" now live on the
// `game` object passed in as a prop, updated via `setGame(updater)`.
// Roster and season-long stats are league-level concerns owned by the
// caller (LeagueWorkspace) and passed through as props.

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown, X, Lock, Check, Plus, Printer, FileDown, Share2 } from "lucide-react";
import {
  createBattingSlots,
  validateSubstitution,
  recordSubstitution,
  getSlotBadge,
  computeParticipation,
  occupantAtInning,
  findReentrySlot,
  isBarred,
  orderPlayersByStartingLineup,
} from "./battingRules";
import { STAT_FIELDS, emptyStatLine, reconcileWarning } from "./stats";
import {
  POSITIONS, EP_SLOTS, HOME, BASE_1B, BASE_2B, BASE_3B,
  FOUL_LINE_RIGHT_END, FOUL_LINE_LEFT_END, baseMarkerPath,
  BASE_DIAMOND_PATH, INFIELD_SKIN_PATH, FENCE_ARC_PATH, INNINGS,
  COLORS, initials, gameLabel, isGameOver,
} from "./constants";
import { TopHeader, PlayerChip, CollapsibleCard } from "./ui";
import RosterCard from "./RosterCard";
import GameScoresCard from "./GameScoresCard";
import PrintableLineupCard from "./PrintableLineupCard";
import StartingLineupCard from "./StartingLineupCard";
import { downloadLineupPdf, downloadCardPdf } from "./print";

export default function GameWorkspace({ game, setGame, players, setPlayers, deletePlayer, statLines, setStatLines, leagueName, teamName, onBack }) {
  const [gameStatsCardOpen, setGameStatsCardOpen] = useState(false);
  const [statsFormOpen, setStatsFormOpen] = useState(false);
  const [statsDraft, setStatsDraft] = useState({});
  const [orderOpen, setOrderOpen] = useState(true);
  const [playtimeOpen, setPlaytimeOpen] = useState(false);
  const [pickedUp, setPickedUp] = useState(null);
  const [pickError, setPickError] = useState("");
  const [pendingAdvanceInning, setPendingAdvanceInning] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRef = useRef(null);
  const [shareCardBusy, setShareCardBusy] = useState(false);
  const shareCardRef = useRef(null);
  // Set when placing a returning starter would evict a substitute who is
  // currently fielding a DIFFERENT position than the one just tapped - that
  // eviction empties a position the coach isn't even looking at, so it's
  // confirmed rather than applied silently.
  const [pendingReentry, setPendingReentry] = useState(null);

  // The header's subtitle (opponent/date/time) can wrap to extra lines on a
  // narrow phone, so its rendered height isn't a fixed constant - measure it
  // and the inning-tabs bar so the sticky elements below stack at the right
  // offset instead of a hardcoded guess that only holds for short text.
  const headerRef = useRef(null);
  const tabsRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(74);
  const [tabsHeight, setTabsHeight] = useState(51);

  useLayoutEffect(() => {
    const headerEl = headerRef.current;
    const tabsEl = tabsRef.current;
    if (!headerEl || !tabsEl) return;
    const measure = () => {
      setHeaderHeight(headerEl.offsetHeight);
      setTabsHeight(tabsEl.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(headerEl);
    observer.observe(tabsEl);
    return () => observer.disconnect();
  }, []);

  const { battingOrder, battingOrderSize, gameStarted, startingAssignments, battingSlots, activeInning, fieldingByInning, completedInnings, leagueSettings } = game;
  const fielding = fieldingByInning[activeInning] || {};
  const gameOver = isGameOver(game);
  const activeInningLocked = gameOver || completedInnings.includes(activeInning);

  useEffect(() => {
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 900);
    return () => clearTimeout(t);
  }, [game, players]);

  const playerById = (id) => players.find((p) => p.id === id);

  function handleDeletePlayer(id) {
    deletePlayer(id);
    if (pickedUp === id) {
      setPickedUp(null);
      setPickError("");
    }
  }

  // Writes to the *current* inning's fielding chart only, leaving other
  // innings' charts untouched (Section: multi-inning persistence).
  function setFielding(updater) {
    setGame((prev) => {
      const current = prev.fieldingByInning[prev.activeInning] || {};
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, fieldingByInning: { ...prev.fieldingByInning, [prev.activeInning]: next } };
    });
  }

  // The highest inning that's been opened so far (has a fielding chart,
  // even an empty one) - the boundary past which tabs are unreachable.
  const highestOpenedInning = Math.max(1, ...Object.keys(fieldingByInning).map(Number));

  function selectInning(n) {
    if (completedInnings.includes(n) || fieldingByInning[n]) {
      setGame((prev) => ({ ...prev, activeInning: n }));
      setPickedUp(null);
      setPickError("");
      return;
    }
    if (!gameOver && n === highestOpenedInning + 1) {
      setPendingAdvanceInning(n);
    }
  }

  // pendingAdvanceInning holds the inning that would come next. When the
  // currently open inning is the final one, this is set past INNINGS.length
  // as a sentinel meaning "no next inning" - the banner then only offers
  // Cancel / Game is set instead of a "move to next inning" option.
  const pendingIsFinal = pendingAdvanceInning != null && pendingAdvanceInning > INNINGS.length;

  function confirmAdvanceInning() {
    const completing = highestOpenedInning;
    const next = pendingAdvanceInning;
    if (next == null) return;
    setGame((prev) => {
      const nextCompleted = prev.completedInnings.includes(completing) ? prev.completedInnings : [...prev.completedInnings, completing];
      if (next > INNINGS.length) return { ...prev, completedInnings: nextCompleted };
      const nextFielding = prev.fieldingByInning[next]
        ? prev.fieldingByInning
        : { ...prev.fieldingByInning, [next]: { ...(prev.fieldingByInning[completing] || {}) } };
      return { ...prev, completedInnings: nextCompleted, fieldingByInning: nextFielding, activeInning: next };
    });
    setPendingAdvanceInning(null);
    setPickedUp(null);
    setPickError("");
  }

  function cancelAdvanceInning() {
    setPendingAdvanceInning(null);
  }

  // Ends the game outright from the completion banner: locks the inning
  // being confirmed and marks the game over in one action.
  function confirmGameIsSet() {
    const completing = highestOpenedInning;
    setGame((prev) => ({
      ...prev,
      completedInnings: prev.completedInnings.includes(completing) ? prev.completedInnings : [...prev.completedInnings, completing],
      gameStarted: false,
    }));
    setPendingAdvanceInning(null);
    setPickedUp(null);
    setPickError("");
  }

  // Resumes a game that was marked set, leaving all recorded innings and
  // assignments untouched - unlike Start game, which resets everything.
  function editCompletedGame() {
    setGame((prev) => ({ ...prev, gameStarted: true }));
  }

  function completeCurrentInning() {
    setPendingAdvanceInning(highestOpenedInning + 1);
  }

  function reopenInning(n) {
    setGame((prev) => ({ ...prev, completedInnings: prev.completedInnings.filter((x) => x !== n) }));
  }

  function addToOrder(id) {
    if (battingOrder.includes(id) || battingOrder.length >= battingOrderSize) return;
    setGame((prev) => ({ ...prev, battingOrder: [...prev.battingOrder, id] }));
  }

  function removeFromOrder(id) {
    setGame((prev) => {
      const nextOrder = prev.battingOrder.filter((pid) => pid !== id);
      const nextFielding = {};
      for (const inn of Object.keys(prev.fieldingByInning)) {
        const chart = { ...prev.fieldingByInning[inn] };
        for (const pos of Object.keys(chart)) if (chart[pos] === id) delete chart[pos];
        nextFielding[inn] = chart;
      }
      return { ...prev, battingOrder: nextOrder, fieldingByInning: nextFielding };
    });
    if (pickedUp === id) {
      setPickedUp(null);
      setPickError("");
    }
  }

  function moveOrder(index, dir) {
    setGame((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.battingOrder.length) return prev;
      const next = [...prev.battingOrder];
      [next[index], next[j]] = [next[j], next[index]];
      return { ...prev, battingOrder: next };
    });
  }

  function togglePickup(id) {
    if (activeInningLocked) return;
    if (pendingReentry) return;
    setPickError("");
    setPickedUp((prev) => (prev === id ? null : id));
  }

  // The actual state mutation for placing incomingId onto posId, given the
  // batting-slot index it affects (outIdx, or -1 if this placement doesn't
  // touch the batting order at all). Shared by the direct path in placeOn
  // and the confirmed path in confirmReentry.
  function applyPlacement(incomingId, posId, outIdx, isNewToOrder) {
    const outgoingBattingPlayerId = outIdx !== -1 ? battingOrder[outIdx] : null;
    setGame((prev) => {
      const currentFielding = { ...(prev.fieldingByInning[prev.activeInning] || {}) };
      for (const pos of Object.keys(currentFielding)) {
        if (currentFielding[pos] === incomingId) delete currentFielding[pos];
        if (outgoingBattingPlayerId && currentFielding[pos] === outgoingBattingPlayerId) delete currentFielding[pos];
      }
      currentFielding[posId] = incomingId;
      const nextFieldingByInning = { ...prev.fieldingByInning, [prev.activeInning]: currentFielding };

      let nextBattingOrder = prev.battingOrder;
      let nextBattingSlots = prev.battingSlots;
      if (isNewToOrder) {
        if (outIdx !== -1) {
          nextBattingOrder = [...prev.battingOrder];
          nextBattingOrder[outIdx] = incomingId;
        } else if (prev.battingOrder.length < prev.battingOrderSize) {
          nextBattingOrder = [...prev.battingOrder, incomingId];
        }
        if (outIdx !== -1 && prev.battingSlots[outIdx]) {
          nextBattingSlots = recordSubstitution(prev.battingSlots, outIdx, incomingId, prev.activeInning);
        }
      }

      return { ...prev, fieldingByInning: nextFieldingByInning, battingOrder: nextBattingOrder, battingSlots: nextBattingSlots };
    });
    setPickedUp(null);
    setPickError("");
  }

  function placeOn(posId) {
    if (activeInningLocked) return;
    if (!pickedUp) return;
    if (pendingReentry) return;
    const player = playerById(pickedUp);
    if (!player) return;
    const isEP = posId.startsWith("EP");
    if (!isEP && !player.eligiblePositions.includes(posId)) {
      setPickError(`${player.name} isn't eligible for ${posId}.`);
      return;
    }
    const isNewToOrder = !battingOrder.includes(pickedUp);
    // A substitute who's already been subbed out is done for the game -
    // block them from fielding ANY position, not just one currently held by
    // someone in the batting order. Without this, tapping them onto a
    // vacant position (e.g. one just emptied by a starter's re-entry) would
    // silently put a non-batter on defense, since outIdx below stays -1 for
    // an empty position and skips the validateSubstitution/isBarred check
    // that only runs when a specific slot is being displaced.
    if (isNewToOrder && isBarred(battingSlots, battingOrder, pickedUp)) {
      setPickError(`${player.name} already left the game and can't return.`);
      return;
    }
    // Which batting slot does this placement affect, if any? Resolved by
    // the INCOMING player's own identity, not by whichever fielding
    // position they're tapped onto (Decision 37).
    let outIdx = -1;
    let viaReentry = false;
    if (isNewToOrder) {
      const reentrySlot = findReentrySlot(battingSlots, battingOrder, pickedUp);
      if (reentrySlot !== -1) {
        outIdx = reentrySlot;
        viaReentry = true;
      } else {
        const outgoingId = fielding[posId] || null;
        outIdx = outgoingId ? battingOrder.indexOf(outgoingId) : -1;
      }
    }

    // A player new to the order can only take the field by claiming a batting
    // slot - either the one belonging to whoever they're displacing (outIdx
    // resolved above) or an open slot at the end of the order. If neither
    // exists (order already full and the tapped position happens to be
    // vacant - e.g. a starter is sitting out D this inning without anyone
    // else covering it), there's no slot for them to claim, so this would
    // otherwise put a fielder on the diamond who's absent from the batting
    // order entirely.
    if (isNewToOrder && outIdx === -1 && battingOrder.length >= battingOrderSize) {
      setPickError(`${player.name} can't take the field — the lineup is full. Bench someone from the batting order first.`);
      return;
    }

    if (outIdx !== -1 && battingSlots[outIdx]) {
      const result = validateSubstitution(battingSlots, battingOrder, outIdx, pickedUp, leagueSettings.reEntryPolicy);
      if (!result.ok) {
        setPickError(`${player.name} ${result.message}`);
        return;
      }
    }

    // Re-entry is resolved by the returning starter's own original slot, not
    // by the position they're tapped onto (Decision 37) - so the substitute
    // it evicts from that slot may currently be fielding a completely
    // different, unrelated position. Confirm before silently vacating it.
    if (viaReentry && outIdx !== -1) {
      const evictedId = battingOrder[outIdx];
      const evictedPosition = Object.keys(fielding).find((pos) => fielding[pos] === evictedId) || null;
      if (evictedPosition && evictedPosition !== posId) {
        setPendingReentry({
          incomingId: pickedUp,
          incomingName: player.name,
          posId,
          outIdx,
          evictedId,
          evictedName: playerById(evictedId)?.name || "that player",
          evictedPosition,
        });
        return;
      }
    }

    applyPlacement(pickedUp, posId, outIdx, isNewToOrder);
  }

  function confirmReentry() {
    if (!pendingReentry) return;
    const { incomingId, posId, outIdx } = pendingReentry;
    applyPlacement(incomingId, posId, outIdx, true);
    setPendingReentry(null);
  }

  function cancelReentry() {
    setPendingReentry(null);
  }

  function benchFromField(id) {
    if (activeInningLocked) return;
    if (pendingReentry) return;
    setFielding((prev) => {
      const next = { ...prev };
      for (const pos of Object.keys(next)) if (next[pos] === id) delete next[pos];
      return next;
    });
    if (pickedUp === id) {
      setPickedUp(null);
      setPickError("");
    }
  }

  // Number of EP spots is derived from the chosen lineup size, not from
  // batting-order position — 10 fielders + up to 4 EP (Decision 21).
  const epCount = Math.max(0, Math.min(EP_SLOTS.length, battingOrderSize - 10));
  const epSlotsToShow = EP_SLOTS.slice(0, epCount);
  const allSlots = [...POSITIONS, ...epSlotsToShow];

  const displayBattingOrder = activeInningLocked
    ? battingOrder.map((liveId, idx) => {
        const slot = battingSlots[idx];
        return slot ? occupantAtInning(slot, activeInning) || liveId : liveId;
      })
    : battingOrder;
  const orderPlayers = displayBattingOrder.map((id) => playerById(id)).filter(Boolean);
  const fieldedIds = new Set(Object.values(fielding));
  const unfieldedPlayers = players.filter((p) => !fieldedIds.has(p.id));
  const notInOrder = players.filter((p) => !battingOrder.includes(p.id));
  const orderCountOk = battingOrder.length === battingOrderSize;
  const filledCount = Object.keys(fielding).length;

  function currentPositionLabel(playerId) {
    const entry = Object.entries(fielding).find(([, pid]) => pid === playerId);
    return entry ? entry[0] : "Bench";
  }

  function startingPositionLabel(playerId) {
    return gameStarted ? startingAssignments[playerId] || "Bench" : null;
  }

  function isStartingEP(playerId) {
    const label = startingPositionLabel(playerId);
    return !!label && label.startsWith("EP");
  }

  const hasPlaytimeData = completedInnings.length > 0;
  const { participation, completedInningsSorted } = hasPlaytimeData
    ? computeParticipation({ players, battingOrder, battingSlots, fieldingByInning, completedInnings })
    : { participation: {}, completedInningsSorted: [] };

  // Starting lineup top-to-bottom, then subs by when they entered, then
  // anyone who never appeared this game - shared ordering for the Playtime
  // report and Game stats entry so both read like the lineup card.
  const playersInLineupOrder = orderPlayersByStartingLineup(players, battingSlots);

  const gameStatPlayerIds = new Set();
  for (const idx of Object.keys(battingSlots)) {
    for (const event of battingSlots[idx].history) gameStatPlayerIds.add(event.playerId);
  }
  const gameStatPlayers = playersInLineupOrder.filter((p) => gameStatPlayerIds.has(p.id));
  const currentGameStatLines = statLines.filter((l) => l.gameId === game.id);
  const hasEnteredStatsForCurrentGame = currentGameStatLines.length > 0;

  function openStatsForm() {
    const draft = {};
    for (const p of gameStatPlayers) {
      const existing = currentGameStatLines.find((l) => l.playerId === p.id);
      draft[p.id] = existing ? { ...existing } : emptyStatLine();
    }
    setStatsDraft(draft);
    setStatsFormOpen(true);
  }

  function updateStatDraft(playerId, key, value) {
    const n = Math.max(0, Number(value) || 0);
    setStatsDraft((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [key]: n } }));
  }

  function submitStatsForm(e) {
    e.preventDefault();
    const newLines = gameStatPlayers.map((p) => ({
      gameId: game.id,
      gameDate: game.date,
      playerId: p.id,
      ...statsDraft[p.id],
    }));
    setStatLines((prev) => [...prev.filter((l) => l.gameId !== game.id), ...newLines]);
    setStatsFormOpen(false);
  }

  async function handleDownloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const filename = `${gameLabel(game, teamName).replace(/[^\w.-]+/g, "_")}.pdf`;
      await downloadLineupPdf(printRef.current, filename);
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleShareLineupCard() {
    if (shareCardBusy) return;
    setShareCardBusy(true);
    try {
      const filename = `${gameLabel(game, teamName).replace(/[^\w.-]+/g, "_")}_starting_lineup.pdf`;
      await downloadCardPdf(shareCardRef.current, filename);
    } finally {
      setShareCardBusy(false);
    }
  }

  return (
    <div>
      <TopHeader
        ref={headerRef}
        title={leagueName}
        subtitle={`${gameLabel(game, teamName)} — tap a player, then tap where they play.`}
        onBack={onBack}
        right={
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: justSaved ? COLORS.gold : "transparent", transition: "color .3s ease", fontWeight: 600 }}>
              Saved
            </span>
            {/* Print/export (Section 4a/6): icon buttons in the sticky top
                header rather than a fixed bottom bar - always reachable
                without ever sitting on top of the diamond/bench tap
                targets the way a viewport-anchored bottom bar would on a
                short screen. */}
            <button
              type="button"
              className="lb-btn"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              aria-label="Download PDF"
              title="Download PDF"
              style={{ background: "transparent", color: COLORS.chalk, padding: 4, display: "flex", opacity: pdfBusy ? 0.5 : 1 }}
            >
              <FileDown size={18} />
            </button>
            <button
              type="button"
              className="lb-btn"
              onClick={() => window.print()}
              aria-label="Print lineup card"
              title="Print"
              style={{ background: "transparent", color: COLORS.chalk, padding: 4, display: "flex" }}
            >
              <Printer size={18} />
            </button>
          </span>
        }
      />

      {/* Inning tabs */}
      <div
        ref={tabsRef}
        style={{
          position: "sticky",
          top: headerHeight,
          zIndex: 18,
          background: COLORS.cream,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "8px 16px",
        }}
      >
      <div
        className="lb-page-inner"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, flexShrink: 0 }}>Inning</span>
        {INNINGS.map((n) => {
          const isActive = n === activeInning;
          const isCompleted = completedInnings.includes(n);
          const isOpened = !!fieldingByInning[n];
          const isReachable = isOpened || (!gameOver && n === highestOpenedInning + 1);
          const hasChart = isOpened && Object.keys(fieldingByInning[n]).length > 0;
          return (
            <button
              key={n}
              className="lb-btn"
              onClick={() => selectInning(n)}
              disabled={!isReachable}
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: isActive ? COLORS.ink : "#fff",
                color: isActive ? COLORS.chalk : isReachable ? COLORS.ink : "#CFC8B4",
                border: `1px solid ${isActive ? COLORS.ink : COLORS.border}`,
                fontSize: 14,
                fontWeight: 700,
                position: "relative",
                opacity: isReachable ? 1 : 0.55,
              }}
              aria-label={`Inning ${n}${isCompleted ? ", completed" : ""}`}
              aria-current={isActive ? "true" : undefined}
            >
              {n}
              {isCompleted ? (
                <span
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: COLORS.turf,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1px solid ${COLORS.cream}`,
                  }}
                >
                  <Check size={9} color="#fff" strokeWidth={3} />
                </span>
              ) : (
                hasChart &&
                !isActive && (
                  <span
                    style={{ position: "absolute", bottom: 2, right: 4, width: 5, height: 5, borderRadius: "50%", background: COLORS.gold }}
                  />
                )
              )}
            </button>
          );
        })}
      </div>
      </div>

      {/* Advance-inning / end-of-game confirmation */}
      {pendingAdvanceInning != null && (
        <div
          style={{
            position: "sticky",
            top: headerHeight + tabsHeight,
            zIndex: 19,
            margin: "0 0 4px",
            padding: "12px 16px",
            background: COLORS.ink,
            color: COLORS.chalk,
          }}
        >
          <div className="lb-page-inner" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {pendingIsFinal ? `Final inning (${highestOpenedInning}) complete?` : `Inning ${highestOpenedInning} complete?`}
            </span>
            <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
              <button
                className="lb-btn"
                onClick={cancelAdvanceInning}
                style={{ background: "transparent", border: `1px solid ${COLORS.chalk}`, borderRadius: 8, color: COLORS.chalk, fontWeight: 700, padding: "6px 14px", fontSize: 13 }}
              >
                Cancel
              </button>
              {!pendingIsFinal && (
                <button
                  className="lb-btn"
                  onClick={confirmAdvanceInning}
                  style={{ background: "transparent", border: `1px solid ${COLORS.gold}`, borderRadius: 8, color: COLORS.gold, fontWeight: 700, padding: "6px 14px", fontSize: 13 }}
                >
                  Move to Inning {pendingAdvanceInning}
                </button>
              )}
              <button
                className="lb-btn"
                onClick={confirmGameIsSet}
                style={{ background: COLORS.gold, border: `1px solid ${COLORS.gold}`, borderRadius: 8, color: COLORS.ink, fontWeight: 700, padding: "6px 14px", fontSize: 13 }}
              >
                Game is set
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Locked (completed) inning banner */}
      {activeInningLocked && pendingAdvanceInning == null && (
        <div
          style={{
            position: "sticky",
            top: headerHeight + tabsHeight,
            zIndex: 19,
            margin: "0 0 4px",
            padding: "10px 16px",
            background: COLORS.chalk,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.inkSoft,
          }}
        >
          <div className="lb-page-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600, gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} /> Viewing Inning {activeInning} — {gameOver ? "game completed" : "completed"}
            </span>
            {!gameOver && (
              <button
                className="lb-btn"
                onClick={() => reopenInning(activeInning)}
                style={{ background: "transparent", border: `1px solid ${COLORS.inkSoft}`, borderRadius: 8, color: COLORS.inkSoft, fontWeight: 700, padding: "5px 10px", fontSize: 12 }}
              >
                Reopen to edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Re-entry eviction confirmation */}
      {pendingReentry && (
        <div
          style={{
            position: "sticky",
            top: headerHeight + tabsHeight,
            zIndex: 19,
            margin: "0 0 4px",
            padding: "12px 16px",
            background: COLORS.ink,
            color: COLORS.chalk,
          }}
        >
          <div className="lb-page-inner" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {pendingReentry.incomingName} re-enters batting — {pendingReentry.evictedName} leaves the game and {pendingReentry.evictedPosition} will need a new fielder.
            </span>
            <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
              <button
                className="lb-btn"
                onClick={cancelReentry}
                style={{ background: "transparent", border: `1px solid ${COLORS.chalk}`, borderRadius: 8, color: COLORS.chalk, fontWeight: 700, padding: "6px 14px", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                className="lb-btn"
                onClick={confirmReentry}
                style={{ background: COLORS.gold, border: `1px solid ${COLORS.gold}`, borderRadius: 8, color: COLORS.ink, fontWeight: 700, padding: "6px 14px", fontSize: 13 }}
              >
                Confirm
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Pickup banner */}
      {!activeInningLocked && pickedUp && !pendingReentry && (
        <div
          style={{
            position: "sticky",
            top: headerHeight + tabsHeight,
            zIndex: 19,
            margin: "0 0 4px",
            padding: "10px 16px",
            background: COLORS.gold,
            color: COLORS.ink,
          }}
        >
          <div className="lb-page-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}>
            <span>Placing {playerById(pickedUp)?.name} — tap a position</span>
            <button
              className="lb-btn"
              onClick={() => {
                setPickedUp(null);
                setPickError("");
              }}
              style={{ background: "transparent", color: COLORS.ink, fontWeight: 700, padding: "4px 8px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {pickError && (
        <div style={{ padding: "0 16px 8px" }}>
          <div className="lb-page-inner" style={{ background: COLORS.dangerBg, color: COLORS.danger, borderRadius: 10, fontSize: 13, fontWeight: 600, padding: "8px 12px" }}>
            {pickError}
          </div>
        </div>
      )}

      <div className="lb-layout">
        <div className="lb-main">
          {/* Fielding diamond */}
          <section style={{ padding: "12px 16px 4px" }}>
            <div className="lb-diamond-wrap" style={{ background: COLORS.card, borderRadius: 16, padding: 12, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>On the field</h2>
                <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>
                  {filledCount}/{10 + epCount} filled
                </span>
              </div>
              {activeInning === highestOpenedInning && !activeInningLocked && pendingAdvanceInning == null && !pendingReentry && (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="lb-btn"
                    onClick={completeCurrentInning}
                    style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${COLORS.turf}`, color: COLORS.turfDark, fontSize: 12, fontWeight: 700 }}
                  >
                    {highestOpenedInning >= INNINGS.length ? `Complete final inning (${highestOpenedInning})` : `Complete Inning ${highestOpenedInning} →`}
                  </button>
                </div>
              )}
              <svg viewBox="0 0 380 445" style={{ width: "100%", display: "block" }}>
                <defs>
                  <clipPath id="fieldClip">
                    <rect x="0" y="0" width="380" height="445" rx="18" />
                  </clipPath>
                  <radialGradient id="grassVignette" cx="50%" cy="36%" r="75%">
                    <stop offset="0%" stopColor={COLORS.turfLight} />
                    <stop offset="60%" stopColor={COLORS.turf} />
                    <stop offset="100%" stopColor={COLORS.turfDark} />
                  </radialGradient>
                  <radialGradient id="moundGradient" cx="40%" cy="35%" r="70%">
                    <stop offset="0%" stopColor={COLORS.dirtLight} />
                    <stop offset="100%" stopColor={COLORS.clay} />
                  </radialGradient>
                  <radialGradient id="markerEmpty" cx="35%" cy="30%" r="72%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.38)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
                  </radialGradient>
                  <radialGradient id="markerOccupied" cx="35%" cy="30%" r="72%">
                    <stop offset="0%" stopColor={COLORS.inkSoft} />
                    <stop offset="100%" stopColor={COLORS.ink} />
                  </radialGradient>
                  <radialGradient id="markerOccupiedEP" cx="35%" cy="30%" r="72%">
                    <stop offset="0%" stopColor="#6FA8D6" />
                    <stop offset="100%" stopColor={COLORS.epBlue} />
                  </radialGradient>
                </defs>

                <rect x="0" y="0" width="380" height="445" rx="18" fill="url(#grassVignette)" />

                <g clipPath="url(#fieldClip)">
                  {[...Array(9)].map((_, i) => (
                    <rect
                      key={i}
                      x={-120 + i * 80}
                      y="-100"
                      width="38"
                      height="800"
                      fill={i % 2 === 0 ? "#FFFFFF" : "#000000"}
                      opacity="0.035"
                      transform="rotate(28 190 222)"
                    />
                  ))}
                </g>

                <path d={FENCE_ARC_PATH} fill="none" stroke={COLORS.clay} strokeWidth="7.5" />

                <path d={INFIELD_SKIN_PATH} fill={COLORS.clay} />
                <path d={BASE_DIAMOND_PATH} fill="none" stroke={COLORS.clay} strokeWidth="9" strokeLinejoin="round" />

                <circle cx={HOME.x} cy={HOME.y} r="22" fill={COLORS.clay} />
                <circle cx="190" cy="260" r="32" fill="url(#moundGradient)" opacity="0.95" />

                <line x1={HOME.x} y1={HOME.y} x2={FOUL_LINE_RIGHT_END.x} y2={FOUL_LINE_RIGHT_END.y} stroke={COLORS.chalk} strokeWidth="3" opacity="0.9" />
                <line x1={HOME.x} y1={HOME.y} x2={FOUL_LINE_LEFT_END.x} y2={FOUL_LINE_LEFT_END.y} stroke={COLORS.chalk} strokeWidth="3" opacity="0.9" />

                <rect x={HOME.x - 24} y={HOME.y - 18} width="12" height="20" fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />
                <rect x={HOME.x + 12} y={HOME.y - 18} width="12" height="20" fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />

                <path d={baseMarkerPath(BASE_1B.x, BASE_1B.y)} fill={COLORS.chalk} stroke="#B7AE8E" strokeWidth="1" />
                <path d={baseMarkerPath(BASE_2B.x, BASE_2B.y)} fill={COLORS.chalk} stroke="#B7AE8E" strokeWidth="1" />
                <path d={baseMarkerPath(BASE_3B.x, BASE_3B.y)} fill={COLORS.chalk} stroke="#B7AE8E" strokeWidth="1" />

                <path
                  d={`M${HOME.x},${HOME.y} L${HOME.x + 7},${HOME.y - 8} L${HOME.x + 7},${HOME.y - 14} L${HOME.x - 7},${HOME.y - 14} L${HOME.x - 7},${HOME.y - 8} Z`}
                  fill={COLORS.chalk}
                  stroke="#B7AE8E"
                  strokeWidth="1"
                />

                {allSlots.map((pos) => {
                  const isEP = pos.id.startsWith("EP");
                  const r = isEP ? 22 : 27;
                  const crossHalf = r * 0.32;
                  const occupantId = fielding[pos.id];
                  const occupant = occupantId ? playerById(occupantId) : null;
                  const occupantStartedAsEP = occupant ? isStartingEP(occupant.id) : false;
                  const pickedPlayer = pickedUp ? playerById(pickedUp) : null;
                  const isEligiblePreview = pickedPlayer ? isEP || pickedPlayer.eligiblePositions.includes(pos.id) : null;
                  let ringColor = "rgba(255,255,255,0.55)";
                  let ringWidth = 2;
                  if (pickedPlayer) {
                    ringColor = isEligiblePreview ? COLORS.gold : "#D98C7C";
                    ringWidth = isEligiblePreview ? 4 : 3;
                  } else if (occupant) {
                    ringColor = COLORS.gold;
                    ringWidth = 3;
                  }
                  const markerFill = occupant
                    ? (occupantStartedAsEP ? "url(#markerOccupiedEP)" : "url(#markerOccupied)")
                    : "url(#markerEmpty)";
                  return (
                    <g
                      key={pos.id}
                      className="lb-slot lb-btn"
                      onClick={() => placeOn(pos.id)}
                      role="button"
                      aria-label={`Position ${pos.id}${occupant ? `, ${occupant.name}` : ", empty"}`}
                      style={{ cursor: activeInningLocked ? "default" : pickedUp ? "pointer" : occupant ? "pointer" : "default" }}
                    >
                      <circle cx={pos.x} cy={pos.y} r={r} fill={markerFill} stroke="none" />
                      <circle className="ring" cx={pos.x} cy={pos.y} r={r} fill="none" stroke={ringColor} strokeWidth={ringWidth} strokeDasharray={occupant ? "0" : "4 4"} />
                      {occupant ? (
                        <>
                          <text x={pos.x} y={pos.y - 3} textAnchor="middle" fontSize="13" fontWeight="800" fill={COLORS.chalk}>
                            {initials(occupant.name)}
                          </text>
                          <text x={pos.x} y={pos.y + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill={COLORS.gold}>
                            #{occupant.jerseyNumber || "–"}
                          </text>
                        </>
                      ) : (
                        <>
                          <line x1={pos.x - crossHalf} y1={pos.y} x2={pos.x + crossHalf} y2={pos.y} stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1={pos.x} y1={pos.y - crossHalf} x2={pos.x} y2={pos.y + crossHalf} stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />
                        </>
                      )}
                      <text
                        x={pos.x}
                        y={pos.y - r - 8}
                        textAnchor="middle"
                        fontSize={isEP ? 10 : 11}
                        fontWeight="800"
                        fill={COLORS.chalk}
                        stroke={COLORS.ink}
                        strokeWidth="3"
                        strokeOpacity="0.55"
                        paintOrder="stroke"
                        letterSpacing="0.5"
                      >
                        {pos.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Bench */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 6 }}>
                Bench {unfieldedPlayers.length > 0 ? `(${unfieldedPlayers.length})` : ""}
              </div>
              {unfieldedPlayers.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.muted }}>Everyone in the lineup is on the field.</div>
              ) : (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {unfieldedPlayers.map((p) => (
                    <PlayerChip
                      key={p.id}
                      player={p}
                      picked={pickedUp === p.id}
                      onClick={() => togglePickup(p.id)}
                      label="Bench"
                      isStartingEP={isStartingEP(p.id)}
                      disabled={activeInningLocked}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fielded players (including EP), tap to pick back up */}
            {filledCount > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 6 }}>On the field — tap to move or bench</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {allSlots
                    .filter((pos) => fielding[pos.id])
                    .map((pos) => {
                      const posId = pos.id;
                      const playerId = fielding[posId];
                      const p = playerById(playerId);
                      if (!p) return null;
                      const startedAsEP = isStartingEP(playerId);
                      return (
                        <div
                          key={posId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: startedAsEP ? COLORS.epBluePale : COLORS.card,
                            border: `1px solid ${startedAsEP ? COLORS.epBlueBorder : COLORS.border}`,
                            borderRadius: 999,
                            padding: "5px 6px 5px 10px",
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.goldDeep }}>{posId}</span>
                          <button
                            className="lb-btn"
                            onClick={() => togglePickup(playerId)}
                            disabled={activeInningLocked}
                            style={{
                              background: pickedUp === playerId ? COLORS.gold : "transparent",
                              borderRadius: 999,
                              padding: "3px 8px",
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.ink,
                              opacity: activeInningLocked ? 0.55 : 1,
                            }}
                          >
                            {p.name} <span style={{ color: COLORS.goldDeep }}>#{p.jerseyNumber || "–"}</span>
                          </button>
                          {!activeInningLocked && (
                            <button className="lb-btn" onClick={() => benchFromField(playerId)} aria-label={`Bench ${p.name}`} style={{ background: "transparent", color: COLORS.muted, padding: 4, display: "flex" }}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="lb-sidebar">
          {/* Batting order */}
          <section style={{ padding: "12px 16px 4px" }}>
            <CollapsibleCard title="Batting order" subtitle={`${battingOrder.length} of ${battingOrderSize}`} subtitleWarn={!orderCountOk} open={orderOpen} onToggle={() => setOrderOpen((v) => !v)}>
              {!orderCountOk && (
                <div style={{ fontSize: 13, color: COLORS.danger, marginBottom: 8, fontWeight: 600 }}>
                  {battingOrder.length < battingOrderSize
                    ? `Add ${battingOrderSize - battingOrder.length} more to reach the lineup size of ${battingOrderSize}.`
                    : `Remove ${battingOrder.length - battingOrderSize} to match the lineup size of ${battingOrderSize}.`}
                </div>
              )}
              {orderPlayers.length === 0 && (
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>No one's in the batting order yet — add players from the roster below.</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {orderPlayers.map((p, i) => {
                  const posLabel = currentPositionLabel(p.id);
                  const currentIsEP = posLabel.startsWith("EP");
                  const startLabel = startingPositionLabel(p.id);
                  const startedAsEP = isStartingEP(p.id);
                  const badgeColor = startedAsEP ? COLORS.epBlue : posLabel === "Bench" ? COLORS.muted : currentIsEP ? COLORS.gold : COLORS.turf;
                  const displayLabel = startLabel && startLabel !== posLabel ? `${startLabel} → ${posLabel}` : posLabel;
                  const starterName = playerById(battingSlots[i]?.starterId)?.name;
                  const badge = getSlotBadge(battingSlots, i, p.id, leagueSettings.reEntryPolicy, activeInningLocked ? activeInning : undefined, starterName);
                  const badgeBg = badge?.tone === "reentered" ? COLORS.gold : badge?.tone === "sub" ? COLORS.clay : "transparent";
                  const badgeFg = badge?.tone === "starter" ? COLORS.muted : "#fff";
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: startedAsEP ? COLORS.epBluePale : COLORS.card,
                        border: `1px solid ${startedAsEP ? COLORS.epBlueBorder : COLORS.border}`,
                        borderRadius: 10,
                        padding: "8px 10px",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: badgeColor,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{displayLabel} · #{p.jerseyNumber || "–"}</span>
                          {badge && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: badgeBg,
                                color: badgeFg,
                                border: badge.tone === "starter" ? `1px solid ${COLORS.border}` : "none",
                              }}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="lb-btn" onClick={() => moveOrder(i, -1)} disabled={gameStarted || i === 0} style={{ padding: 8, background: "transparent", color: gameStarted || i === 0 ? "#CFC8B4" : COLORS.ink }} aria-label="Move up">
                        <ChevronUp size={18} />
                      </button>
                      <button
                        className="lb-btn"
                        onClick={() => moveOrder(i, 1)}
                        disabled={gameStarted || i === orderPlayers.length - 1}
                        style={{ padding: 8, background: "transparent", color: gameStarted || i === orderPlayers.length - 1 ? "#CFC8B4" : COLORS.ink }}
                        aria-label="Move down"
                      >
                        <ChevronDown size={18} />
                      </button>
                      <button className="lb-btn" onClick={() => removeFromOrder(p.id)} disabled={gameStarted} style={{ padding: 8, background: "transparent", color: gameStarted ? "#CFC8B4" : COLORS.danger }} aria-label={`Remove ${p.name} from order`}>
                        <X size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {notInOrder.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>Substitutes</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {notInOrder.map((p) => (
                      <button
                        key={p.id}
                        className="lb-btn"
                        onClick={() => addToOrder(p.id)}
                        disabled={battingOrder.length >= battingOrderSize}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: COLORS.chalk,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 999,
                          padding: "6px 10px 6px 8px",
                          fontSize: 13,
                          fontWeight: 600,
                          opacity: battingOrder.length >= battingOrderSize ? 0.5 : 1,
                        }}
                      >
                        <Plus size={14} /> {p.name}{" "}
                        <span style={{ color: COLORS.muted, fontWeight: 700 }}>#{p.jerseyNumber || "–"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                {!gameStarted && !gameOver ? (
                  <button
                    type="button"
                    className="lb-btn"
                    onClick={() => {
                      const snapshot = {};
                      for (const pid of battingOrder) snapshot[pid] = currentPositionLabel(pid);
                      setGame((prev) => ({
                        ...prev,
                        startingAssignments: snapshot,
                        battingSlots: createBattingSlots(prev.battingOrder, 1),
                        completedInnings: [],
                        fieldingByInning: { 1: prev.fieldingByInning[1] || {} },
                        activeInning: 1,
                        gameStarted: true,
                      }));
                    }}
                    disabled={!orderCountOk}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: orderCountOk ? COLORS.turf : "#E4DCC8",
                      color: orderCountOk ? "#fff" : "#8A9490",
                      fontSize: 16,
                      fontWeight: 800,
                    }}
                  >
                    Start game
                  </button>
                ) : gameOver ? (
                  <button
                    type="button"
                    className="lb-btn"
                    onClick={editCompletedGame}
                    style={{ width: "100%", padding: "10px 16px", borderRadius: 10, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.inkSoft, fontSize: 14, fontWeight: 700 }}
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    className="lb-btn"
                    onClick={handleShareLineupCard}
                    disabled={shareCardBusy}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 10,
                      background: "transparent",
                      border: `1px solid ${COLORS.turf}`,
                      color: COLORS.turfDark,
                      fontSize: 14,
                      fontWeight: 700,
                      opacity: shareCardBusy ? 0.6 : 1,
                    }}
                  >
                    <Share2 size={16} /> {shareCardBusy ? "Preparing…" : "Share lineup card"}
                  </button>
                )}
                {!gameStarted && !gameOver && !orderCountOk && (
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, textAlign: "center" }}>Fill the lineup to {battingOrderSize} to start the game.</div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 6 }}>
                  Lineup size {gameStarted && <span style={{ color: COLORS.muted, fontWeight: 600 }}>— locked, game in progress</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[10, 11, 12, 13, 14].map((n) => {
                    const active = n === battingOrderSize;
                    const disabled = gameStarted || n < battingOrder.length;
                    return (
                      <button
                        type="button"
                        key={n}
                        className="lb-btn"
                        onClick={() => !disabled && setGame((prev) => ({ ...prev, battingOrderSize: n }))}
                        disabled={disabled}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: `1px solid ${active ? COLORS.turf : COLORS.border}`,
                          background: active ? COLORS.turf : "#fff",
                          color: active ? "#fff" : disabled ? "#CFC8B4" : COLORS.ink,
                          fontSize: 13,
                          fontWeight: 700,
                          minWidth: 44,
                          opacity: disabled && !active ? 0.6 : 1,
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 6 }}>
                  Re-entry {gameStarted && <span style={{ color: COLORS.muted, fontWeight: 600 }}>— locked, game in progress</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { value: "once", label: "Once per starter" },
                    { value: "unlimited", label: "Unlimited" },
                  ].map(({ value, label }) => {
                    const active = leagueSettings.reEntryPolicy === value;
                    return (
                      <button
                        type="button"
                        key={value}
                        className="lb-btn"
                        onClick={() => !gameStarted && setGame((prev) => ({ ...prev, leagueSettings: { reEntryPolicy: value } }))}
                        disabled={gameStarted}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: `1px solid ${active ? COLORS.turf : COLORS.border}`,
                          background: active ? COLORS.turf : "#fff",
                          color: active ? "#fff" : gameStarted ? "#CFC8B4" : COLORS.ink,
                          fontSize: 13,
                          fontWeight: 700,
                          opacity: gameStarted && !active ? 0.6 : 1,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CollapsibleCard>
          </section>

          {/* Playtime report */}
          <section style={{ padding: "12px 16px 4px" }}>
            <CollapsibleCard
              title="Playtime report"
              subtitle={hasPlaytimeData ? `${completedInningsSorted.length} inning${completedInningsSorted.length === 1 ? "" : "s"}` : undefined}
              open={playtimeOpen}
              onToggle={() => setPlaytimeOpen((v) => !v)}
            >
              {!hasPlaytimeData ? (
                <div style={{ fontSize: 13, color: COLORS.muted }}>
                  {Object.keys(battingSlots).length > 0 ? "Playtime tracking starts once you complete your first inning." : "Playtime tracking starts once you hit Start game."}
                </div>
              ) : players.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.muted }}>No players on the roster yet.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ textAlign: "left", padding: "6px 4px", color: COLORS.inkSoft }}>Player</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", color: COLORS.inkSoft }}>Batted</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", color: COLORS.inkSoft }}>Fielded</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", color: COLORS.inkSoft }}>Sat out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playersInLineupOrder.map((p) => {
                        const stats = participation[p.id] || { battedInnings: new Set(), fieldedInnings: new Set() };
                        const batted = stats.battedInnings.size;
                        const fielded = stats.fieldedInnings.size;
                        const satOut = Math.max(0, completedInningsSorted.length - batted);
                        return (
                          <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <td style={{ padding: "6px 4px", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {p.name} <span style={{ color: COLORS.muted, fontWeight: 700 }}>#{p.jerseyNumber || "–"}</span>
                            </td>
                            <td style={{ padding: "6px 4px", textAlign: "right" }}>{batted}</td>
                            <td style={{ padding: "6px 4px", textAlign: "right" }}>{fielded}</td>
                            <td style={{ padding: "6px 4px", textAlign: "right", color: satOut > 0 ? COLORS.danger : COLORS.muted }}>{satOut}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleCard>
          </section>

          {/* Game stats entry (Section 3.3/9) */}
          <section style={{ padding: "12px 16px 4px" }}>
            <CollapsibleCard title="Game stats" subtitle={hasEnteredStatsForCurrentGame ? "Entered" : undefined} open={gameStatsCardOpen} onToggle={() => setGameStatsCardOpen((v) => !v)}>
              {!gameOver ? (
                <div style={{ fontSize: 13, color: COLORS.muted }}>Mark the game completed to enter stats for it.</div>
              ) : !statsFormOpen ? (
                <button
                  type="button"
                  className="lb-btn"
                  onClick={openStatsForm}
                  style={{ padding: "8px 14px", borderRadius: 8, background: COLORS.ink, color: COLORS.chalk, fontSize: 13, fontWeight: 700 }}
                >
                  {hasEnteredStatsForCurrentGame ? "Edit game stats" : "Enter game stats"}
                </button>
              ) : (
                <form onSubmit={submitStatsForm}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <th style={{ textAlign: "left", padding: "6px 8px 6px 4px", color: COLORS.inkSoft, whiteSpace: "nowrap" }}>Player</th>
                          {STAT_FIELDS.map((f) => (
                            <th key={f.key} style={{ textAlign: "center", padding: "6px 4px", color: COLORS.inkSoft }}>
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gameStatPlayers.map((p) => {
                          const line = statsDraft[p.id] || emptyStatLine();
                          const warning = reconcileWarning(line);
                          return (
                            <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                              <td style={{ padding: "6px 8px 6px 4px", fontWeight: 600, whiteSpace: "nowrap" }}>
                                {p.name} <span style={{ color: COLORS.muted, fontWeight: 700 }}>#{p.jerseyNumber || "–"}</span>
                                {warning && <div style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600, whiteSpace: "normal" }}>{warning}</div>}
                              </td>
                              {STAT_FIELDS.map((f) => (
                                <td key={f.key} style={{ padding: "4px 3px" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={line[f.key]}
                                    onChange={(e) => updateStatDraft(p.id, f.key, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    style={{ width: 40, padding: "6px 4px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, textAlign: "center" }}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {gameStatPlayers.length === 0 && <div style={{ fontSize: 13, color: COLORS.muted, margin: "8px 0" }}>No players appeared in this game yet.</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button type="submit" className="lb-btn" style={{ flex: 1, background: COLORS.turf, color: "#fff", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700 }}>
                      Save stats
                    </button>
                    <button type="button" className="lb-btn" onClick={() => setStatsFormOpen(false)} style={{ padding: "10px 16px", background: "transparent", color: COLORS.inkSoft, fontWeight: 600, fontSize: 14 }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </CollapsibleCard>
          </section>

          <GameScoresCard game={game} setGame={setGame} teamName={teamName} />

          <RosterCard players={players} setPlayers={setPlayers} onDeletePlayer={handleDeletePlayer} teamName={teamName} />
        </div>
      </div>

      {createPortal(
        <div className="printable-card">
          <PrintableLineupCard ref={printRef} game={game} players={players} leagueName={leagueName} teamName={teamName} />
        </div>,
        document.body
      )}
      {createPortal(
        <div className="capture-only-card">
          <StartingLineupCard ref={shareCardRef} game={game} players={players} teamName={teamName} />
        </div>,
        document.body
      )}
    </div>
  );
}
