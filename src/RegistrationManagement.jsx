// Registration Management panel, nested inside RosterCard's Team Roster
// card (league level). Tracks season-registration bookkeeping that's
// separate from gameplay roster data (name/jersey/eligible positions):
// lunchbox/snack-duty order, team fee, ball/misc fee, and payment status -
// plus a generated PDF report combining any of those with the existing
// gameplay fields (print.js's downloadLineupPdf, same off-screen-capture
// approach as PrintableLineupCard). Total Fees = Team Fee + Ball/Misc Fee +
// (Lunchbox Order x the shared lunchbox unit price entered here) - there's
// no separate amount-paid tracking. Payment Status is a manual Paid/Unpaid
// toggle set here. Notes is a free-text per-player remark field, also
// available as a report column.

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { COLORS, initials } from "./constants";
import { downloadLineupPdf } from "./print";
import RegistrationReportCard from "./RegistrationReportCard";

function computeTotalFees(player, unitPrice) {
  const fee = Number(player.teamFee) || 0;
  const miscFee = Number(player.ballMiscFee) || 0;
  const lunchboxQty = Number(player.lunchboxOrder) || 0;
  return fee + miscFee + lunchboxQty * unitPrice;
}

function formatCurrency(n) {
  return n ? `$${n.toFixed(2)}` : "–";
}

const REPORT_COLUMNS = [
  { key: "jersey", label: "Show Jersey Number", header: "Jersey #", value: (p) => p.jerseyNumber || "–", numeric: true },
  { key: "position", label: "Show Eligible Position", header: "Eligible Position", value: (p) => p.eligiblePositions?.join(", ") || "–" },
  { key: "lunchbox", label: "Show Lunchbox Order", header: "Lunchbox\nOrder", value: (p) => p.lunchboxOrder || "–", numeric: true },
  { key: "fee", label: "Show Team Fee", header: "Team Fee", value: (p) => formatCurrency(Number(p.teamFee) || 0), numeric: true },
  { key: "ballMiscFee", label: "Show Ball/Misc Fee", header: "Ball/Misc\nFee", value: (p) => formatCurrency(Number(p.ballMiscFee) || 0), numeric: true },
  { key: "totalFees", label: "Show Total Fees", header: "Total Fees", value: (p, unitPrice) => formatCurrency(computeTotalFees(p, unitPrice)), numeric: true },
  { key: "paymentStatus", label: "Show Payment Status", header: "Payment Status", value: (p) => (p.paymentStatus === "paid" ? "Paid" : "Unpaid") },
  { key: "note", label: "Show Notes", header: "Note", value: (p) => p.note || "–", align: "left", wrapText: true },
];

function sectionTitleStyle() {
  return { fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 6 };
}

function Avatar({ name }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: COLORS.turf,
        color: "#fff",
        fontSize: 10,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function PlayerRow({ player, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "6px 10px",
      }}
    >
      <Avatar name={player.name} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {player.name}
      </div>
      {children}
    </div>
  );
}

const numberInputStyle = {
  width: 72,
  padding: "6px 8px",
  borderRadius: 8,
  border: `1px solid ${COLORS.border}`,
  fontSize: 13,
  fontWeight: 700,
  textAlign: "right",
};

function NumberEntrySection({ title, players, field, onChange, prefix, step }) {
  return (
    <div>
      <div style={sectionTitleStyle()}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map((p) => (
          <PlayerRow key={p.id} player={p}>
            {prefix && <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted }}>{prefix}</span>}
            <input
              type="number"
              min="0"
              step={step || "1"}
              inputMode={step ? "decimal" : "numeric"}
              value={p[field] ?? ""}
              onChange={(e) => onChange(p.id, field, e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              style={numberInputStyle}
            />
          </PlayerRow>
        ))}
      </div>
    </div>
  );
}

const textInputStyle = {
  flex: 1,
  padding: "6px 8px",
  borderRadius: 8,
  border: `1px solid ${COLORS.border}`,
  fontSize: 13,
  fontWeight: 500,
  minWidth: 0,
};

function NoteSection({ players, onChange }) {
  return (
    <div>
      <div style={sectionTitleStyle()}>Notes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map((p) => (
          <PlayerRow key={p.id} player={p}>
            <input
              type="text"
              value={p.note ?? ""}
              onChange={(e) => onChange(p.id, "note", e.target.value)}
              placeholder="Add a note…"
              style={textInputStyle}
            />
          </PlayerRow>
        ))}
      </div>
    </div>
  );
}

function PaymentStatusSection({ players, onToggle }) {
  return (
    <div>
      <div style={sectionTitleStyle()}>Payment Status</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map((p) => {
          const paid = p.paymentStatus === "paid";
          return (
            <PlayerRow key={p.id} player={p}>
              <button
                type="button"
                className="lb-btn"
                onClick={() => onToggle(p.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: `1px solid ${paid ? COLORS.turf : COLORS.danger}`,
                  background: paid ? COLORS.turf : COLORS.dangerBg,
                  color: paid ? "#fff" : COLORS.danger,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {paid ? "Paid" : "Unpaid"}
              </button>
            </PlayerRow>
          );
        })}
      </div>
    </div>
  );
}

export default function RegistrationManagement({ players, setPlayers, leagueName, teamName, lunchboxUnitPrice, setLunchboxUnitPrice }) {
  const [cols, setCols] = useState(() => Object.fromEntries(REPORT_COLUMNS.map((c) => [c.key, false])));
  const [pdfBusy, setPdfBusy] = useState(false);
  const reportRef = useRef(null);

  const unitPrice = Number(lunchboxUnitPrice) || 0;

  function toggleCol(key) {
    setCols((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateField(id, field, value) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function togglePaid(id) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, paymentStatus: p.paymentStatus === "paid" ? "unpaid" : "paid" } : p))
    );
  }

  const activeCols = REPORT_COLUMNS.filter((c) => cols[c.key]).map((c) => ({ ...c, value: (p) => c.value(p, unitPrice) }));
  const showUnitPriceNote = cols.lunchbox || cols.totalFees;

  async function handleGenerateReport() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const filename = `${(teamName || leagueName || "Team").replace(/[^\w.-]+/g, "_")}_Registration_Report.pdf`;
      await downloadLineupPdf(reportRef.current, filename);
    } finally {
      setPdfBusy(false);
    }
  }

  if (players.length === 0) {
    return (
      <div style={{ background: COLORS.chalk, borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: COLORS.muted }}>Add players to the roster first to manage registration.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORS.chalk,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <div style={sectionTitleStyle()}>Report Options</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginBottom: 10 }}>
          {REPORT_COLUMNS.map((c) => (
            <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
              <input type="checkbox" checked={cols[c.key]} onChange={() => toggleCol(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="lb-btn"
          onClick={handleGenerateReport}
          disabled={pdfBusy}
          style={{
            width: "100%",
            background: COLORS.turf,
            color: "#fff",
            borderRadius: 8,
            padding: "10px 0",
            fontSize: 14,
            fontWeight: 700,
            opacity: pdfBusy ? 0.7 : 1,
          }}
        >
          {pdfBusy ? "Generating…" : "Generate Report"}
        </button>
      </div>

      <div>
        <div style={sectionTitleStyle()}>Lunchbox Order</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: "8px 10px",
            marginBottom: 6,
          }}
        >
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: COLORS.inkSoft }}>Unit price per lunchbox</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted }}>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={lunchboxUnitPrice ?? ""}
            onChange={(e) => setLunchboxUnitPrice(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            style={numberInputStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p) => (
            <PlayerRow key={p.id} player={p}>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={p.lunchboxOrder ?? ""}
                onChange={(e) => updateField(p.id, "lunchboxOrder", e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                style={numberInputStyle}
              />
            </PlayerRow>
          ))}
        </div>
      </div>

      <NumberEntrySection title="Team Fee" players={players} field="teamFee" onChange={updateField} prefix="$" step="0.01" />
      <NumberEntrySection title="Ball/Misc Fee" players={players} field="ballMiscFee" onChange={updateField} prefix="$" step="0.01" />
      <PaymentStatusSection players={players} onToggle={togglePaid} />
      <NoteSection players={players} onChange={updateField} />

      {createPortal(
        <div className="capture-only-card">
          <RegistrationReportCard
            ref={reportRef}
            players={players}
            columns={activeCols}
            leagueName={leagueName}
            teamName={teamName}
            unitPrice={unitPrice}
            showUnitPriceNote={showUnitPriceNote}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
