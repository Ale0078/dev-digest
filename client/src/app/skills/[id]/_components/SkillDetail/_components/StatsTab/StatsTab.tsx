/* StatsTab — 30-day usage of one skill: tiles (Used by, Pull frequency, Accept
   rate ring, Findings), the agents using it (Open → agent Skills tab), and a
   findings-by-category donut of COUNTS. Attribution is correlational. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, CircularScore, Donut, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkillStats } from "../../../../../../../lib/hooks/skills";
import { formatRate } from "../../../../../../../lib/skills";
import { DONUT_SIZE } from "./constants";
import { categorySegments } from "./helpers";
import { s } from "./styles";

export function StatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skillId);

  if (isLoading) return <Skeleton height={160} />;
  if (isError || !stats) return <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />;

  const segments = categorySegments(stats.by_category);
  const correlational = t("stats.correlational");

  return (
    <div style={s.wrap}>
      <div style={s.tiles}>
        <div style={s.tile}>
          <div style={s.tileLabel}>{t("stats.usedBy")}</div>
          <div className="tnum" style={s.tileValue}>
            {t("stats.usedByValue", { count: stats.used_by })}
          </div>
        </div>
        <div style={s.tile}>
          <div style={s.tileLabel}>{t("stats.pullFrequency")}</div>
          <div className="tnum" style={s.tileValue}>
            {formatRate(stats.pull_rate)}
          </div>
        </div>
        <div style={s.tile}>
          <div style={s.tileLabel}>
            {t("stats.acceptRate")}
            <span title={correlational} aria-label={correlational} style={s.info}>
              <Icon.Info size={12} />
            </span>
          </div>
          {stats.accept_rate == null ? (
            <div style={s.tileValue}>—</div>
          ) : (
            <div data-testid="accept-ring">
              <CircularScore score={Math.round(stats.accept_rate * 100)} size={48} />
            </div>
          )}
        </div>
        <div style={s.tile}>
          <div style={s.tileLabel}>
            {t("stats.findings30d")}
            <span title={correlational} aria-label={correlational} style={s.info}>
              <Icon.Info size={12} />
            </span>
          </div>
          <div className="tnum" style={s.tileValue}>
            {stats.findings_30d}
          </div>
        </div>
      </div>

      <div style={s.columns}>
        <section style={s.panel}>
          <h3 style={s.h3}>{t("stats.agentsTitle")}</h3>
          {stats.agents.length === 0 ? (
            <div style={s.muted}>{t("stats.noAgents")}</div>
          ) : (
            stats.agents.map((a) => (
              <div key={a.id} style={s.agentRow}>
                <Icon.Cpu size={14} style={s.agentIcon} />
                <span style={s.agentName}>{a.name}</span>
                <Button
                  kind="secondary"
                  size="sm"
                  iconRight="ArrowRight"
                  onClick={() => router.push(`/agents/${a.id}?tab=skills`)}
                >
                  {t("stats.open")}
                </Button>
              </div>
            ))
          )}
        </section>
        <section style={s.panel}>
          <h3 style={s.h3} title={correlational}>
            {t("stats.byCategory")}
            <span aria-label={correlational} style={s.info}>
              <Icon.Info size={12} />
            </span>
          </h3>
          {segments.length === 0 ? (
            <div style={s.muted}>{t("stats.noFindings")}</div>
          ) : (
            <div style={s.donutRow}>
              {/* Donut's built-in legend prints `$x.xx`; clip it and show counts instead. */}
              <div aria-hidden="true" style={s.donutClip(DONUT_SIZE)}>
                <Donut segments={segments} size={DONUT_SIZE} />
              </div>
              <ul style={s.legend}>
                {segments.map((seg) => (
                  <li key={seg.label} style={s.legendRow}>
                    <span style={s.swatch(seg.color)} />
                    <span style={s.legendLabel}>{seg.label}</span>
                    <span className="mono tnum" style={s.legendValue}>
                      {seg.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
