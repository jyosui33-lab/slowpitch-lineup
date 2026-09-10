import { useState, useEffect } from "react";
import { migrateLegacyDataIfNeeded, readLeagues, writeLeagues, readActiveLeagueId, writeActiveLeagueId } from "./storage";
import { COLORS } from "./constants";
import LeagueMenu from "./LeagueMenu";
import LeagueWorkspace from "./LeagueWorkspace";

export default function App() {
  const [leagues, setLeagues] = useState(() => {
    migrateLegacyDataIfNeeded();
    return readLeagues();
  });
  const [activeLeagueId, setActiveLeagueId] = useState(() => readActiveLeagueId());

  useEffect(() => {
    writeLeagues(leagues);
  }, [leagues]);
  useEffect(() => {
    writeActiveLeagueId(activeLeagueId);
  }, [activeLeagueId]);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId) || null;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh", fontFamily: "-apple-system, system-ui, sans-serif", color: COLORS.ink, paddingBottom: 32 }}>
      <style>{`
        .lb-btn { cursor: pointer; border: none; font: inherit; }
        .lb-btn:active { transform: scale(0.97); }
        .lb-chip { transition: box-shadow .15s ease, background .15s ease; }
        .lb-slot circle.ring { transition: stroke .15s ease, stroke-width .15s ease; }

        /* Responsive layout (Section 4b): mobile is a single column by
           default; at laptop widths this switches to a two-column layout
           via a CSS breakpoint, not JavaScript device detection. */
        .lb-layout { display: block; }
        @media (min-width: 1024px) {
          .lb-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 380px;
            gap: 20px;
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
            align-items: start;
          }
          .lb-sidebar {
            position: sticky;
            top: 96px;
          }
          .lb-diamond-wrap {
            max-width: 520px;
            margin: 0 auto;
          }
        }

        /* Single-column screens (league menu, league workspace lists, and
           the game workspace's header/tabs/banners above the two-column
           split) - same breakpoint as .lb-layout, but centers a narrower
           reading-width column instead of a two-column grid. Colored bars
           (header, banners) keep their own full-width background and just
           center this class around their inner content, so the color still
           reads edge-to-edge instead of looking cut off in a box. */
        @media (min-width: 1024px) {
          .lb-page-inner {
            max-width: 680px;
            margin: 0 auto;
          }
        }

        /* Printable lineup card (Section 6): rendered off-screen at all
           times via a portal to document.body (a sibling of #root, not a
           descendant) so html2canvas can capture it for PDF export
           regardless of what's on screen. @media print swaps the roles -
           the whole app UI hides and the card takes over the page for the
           browser's native Print flow (window.print()). */
        .printable-card {
          position: fixed;
          top: 0;
          left: -10000px;
        }
        @media print {
          #root {
            display: none;
          }
          .printable-card {
            position: static;
            left: auto;
          }
        }

        /* Same off-screen-for-capture trick as .printable-card, but for
           nodes that should only ever be exported via html2canvas (e.g. the
           shareable starting-lineup card) - never swapped into the
           browser's native Print flow, which is reserved for the full
           multi-page report. */
        .capture-only-card {
          position: fixed;
          top: 0;
          left: -10000px;
        }
      `}</style>

      {activeLeague ? (
        <LeagueWorkspace
          key={activeLeague.id}
          league={activeLeague}
          onRenameLeague={({ name, teamName }) =>
            setLeagues((prev) =>
              prev.map((l) => (l.id === activeLeague.id ? { ...l, name, teamName, updatedAt: new Date().toISOString() } : l))
            )
          }
          onDeleteLeague={() => {
            setLeagues((prev) => prev.filter((l) => l.id !== activeLeague.id));
            setActiveLeagueId(null);
          }}
          onBack={() => setActiveLeagueId(null)}
        />
      ) : (
        <LeagueMenu leagues={leagues} setLeagues={setLeagues} onOpenLeague={setActiveLeagueId} />
      )}
    </div>
  );
}
