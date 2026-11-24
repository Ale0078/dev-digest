/* SeverityCountIcons — compact "⊘2 △1 💡2" severity breakdown; empty levels are hidden. */
import React from "react";
import { Icon, SEV } from "@devdigest/ui";
import { SEVERITIES, type SeverityCountMap } from "./helpers";

export function SeverityCountIcons({ counts }: { counts: SeverityCountMap }) {
  const shown = SEVERITIES.filter((sev) => counts[sev] > 0);
  if (shown.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {shown.map((sev) => {
        const I = Icon[SEV[sev].icon];
        return (
          <span
            key={sev}
            aria-label={`${counts[sev]} ${SEV[sev].label}`}
            className="tnum"
            style={{ display: "inline-flex", alignItems: "center", gap: 3, color: SEV[sev].c, fontSize: 12.5, fontWeight: 600 }}
          >
            <I size={13} />
            {counts[sev]}
          </span>
        );
      })}
    </span>
  );
}
