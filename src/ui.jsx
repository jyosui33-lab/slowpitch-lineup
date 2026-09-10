// Small shared presentational components used across the League menu, the
// per-league workspace, and the per-game workspace.

import { forwardRef } from "react";
import { ChevronUp, ChevronDown, ChevronLeft } from "lucide-react";
import { COLORS, initials } from "./constants";

export const TopHeader = forwardRef(function TopHeader({ title, subtitle, onBack, right }, ref) {
  return (
    <div
      ref={ref}
      style={{
        background: COLORS.ink,
        color: COLORS.chalk,
        padding: "18px 16px 16px",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div className="lb-page-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onBack && (
            <button
              className="lb-btn"
              onClick={onBack}
              aria-label="Back"
              style={{ background: "transparent", color: COLORS.chalk, padding: 4, display: "flex", flexShrink: 0 }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h1
            style={{
              margin: 0,
              fontSize: 21,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
          {right}
        </div>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#B9C2BE" }}>{subtitle}</p>}
      </div>
    </div>
  );
});

export function PlayerChip({ player, picked, onClick, label, isStartingEP, disabled }) {
  return (
    <button
      className="lb-btn lb-chip"
      onClick={onClick}
      disabled={disabled}
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: picked ? COLORS.gold : isStartingEP ? COLORS.epBluePale : COLORS.card,
        border: `1px solid ${picked ? COLORS.goldDeep : isStartingEP ? COLORS.epBlueBorder : COLORS.border}`,
        borderRadius: 999,
        padding: "6px 12px 6px 6px",
        boxShadow: picked ? "0 0 0 3px rgba(214,169,58,0.35)" : "none",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label && (
        <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, marginLeft: 4 }}>{label}</span>
      )}
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isStartingEP ? COLORS.epBlue : COLORS.ink,
          color: COLORS.chalk,
          fontSize: 10,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initials(player.name)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
        {player.name}
        <span style={{ color: picked ? COLORS.ink : COLORS.muted, fontWeight: 700 }}> #{player.jerseyNumber || "–"}</span>
      </span>
    </button>
  );
}

export function CollapsibleCard({ title, subtitle, subtitleWarn, open, onToggle, children }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
      <button
        className="lb-btn"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 14px",
          background: "transparent",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {subtitle && (
            <span style={{ fontSize: 12, fontWeight: 600, color: subtitleWarn ? COLORS.danger : COLORS.muted }}>
              {subtitle}
            </span>
          )}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}
