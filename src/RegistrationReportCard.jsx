// The printable Registration Management report: a plain table capturing
// whichever columns the coach checked (jersey/position/lunchbox/fee/total
// due/payment status), exported as a PDF via print.js's downloadLineupPdf
// (same off-screen-capture approach as PrintableLineupCard). Kept off-screen
// by the .capture-only-card CSS rule in App.jsx - this report has no
// on-screen table of its own, only the PDF.
import { forwardRef } from "react";

const th = { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #111", fontSize: 12, whiteSpace: "nowrap" };
const td = { padding: "6px 8px", borderBottom: "1px solid #ccc", fontSize: 12, whiteSpace: "nowrap" };

const RegistrationReportCard = forwardRef(function RegistrationReportCard(
  { players, columns, leagueName, teamName, unitPrice, showUnitPriceNote },
  ref
) {
  return (
    <div ref={ref} style={{ width: 760, background: "#fff", color: "#111", padding: 32, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px solid #111", paddingBottom: 8, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{leagueName || "League"}</div>
          <div style={{ fontSize: 14, color: "#333" }}>{teamName ? `${teamName} — Registration Report` : "Registration Report"}</div>
        </div>
        {showUnitPriceNote && (
          <div style={{ fontSize: 11, color: "#666", textAlign: "right" }}>Lunchbox unit price: ${Number(unitPrice || 0).toFixed(2)}</div>
        )}
      </div>

      <table style={{ width: "auto", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Player</th>
            {columns.map((c) => (
              <th key={c.key} style={{ ...th, textAlign: "right" }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td style={td}>{p.name}</td>
              {columns.map((c) => (
                <td key={c.key} style={{ ...td, textAlign: "right" }}>
                  {c.value(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24, fontSize: 10, color: "#999" }}>Generated {new Date().toLocaleString()}</div>
    </div>
  );
});

export default RegistrationReportCard;
