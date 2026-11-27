/* IntentCard — the PR's derived intent on the Overview tab: quoted summary, in/out of scope,
   risk areas, the sources the classifier saw (with availability), confidence + staleness.
   Detection is user-triggered only; reviews just read the stored intent. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Skeleton, SectionLabel } from "@devdigest/ui";
import type { PrIntentRecord } from "@devdigest/shared";
import { usePrIntent, useDetectIntent } from "@/lib/hooks/intent";
import { ApiError } from "@/lib/api";
import { formatCost, formatTokens } from "@/lib/format";
import { confidenceColors, shortSha, statusColor } from "./helpers";
import { s } from "./styles";

function Bullets({ items, none }: { items: string[]; none: string }) {
  if (items.length === 0) return <span style={s.none}>{none}</span>;
  return (
    <ul style={s.list}>
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  );
}

function Populated({
  intent,
  detecting,
  onDetect,
  error,
}: {
  intent: PrIntentRecord;
  detecting: boolean;
  onDetect: () => void;
  error: string | null;
}) {
  const t = useTranslations("intent");
  const conf = confidenceColors(intent.confidence);
  return (
    <div style={s.card}>
      <div style={s.badges}>
        <Badge color={conf.color} bg={conf.bg}>
          {t("confidence", { level: t(`level.${intent.confidence}`) })}
        </Badge>
        {intent.missing_context.length > 0 && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
            {t("missingContext", { count: intent.missing_context.length })}
          </Badge>
        )}
        {intent.stale && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Clock" mono>
            {t("stale", { sha: shortSha(intent.head_sha) })}
          </Badge>
        )}
        <span style={s.footerSpacer} />
        <Button kind="secondary" size="sm" icon="RefreshCw" loading={detecting} disabled={detecting} onClick={onDetect}>
          {detecting ? t("detecting") : t("redetect")}
        </Button>
      </div>

      <blockquote style={s.summary}>{intent.summary}</blockquote>

      <div style={s.columns}>
        <div>
          <div style={s.colTitle}>{t("inScope")}</div>
          <Bullets items={intent.in_scope} none={t("noneListed")} />
        </div>
        <div>
          <div style={s.colTitle}>{t("outOfScope")}</div>
          <Bullets items={intent.out_of_scope} none={t("noneListed")} />
        </div>
      </div>

      {intent.risk_areas.length > 0 && (
        <div>
          <div style={s.colTitle}>{t("riskAreas")}</div>
          <div style={s.chips}>
            {intent.risk_areas.map((r, i) => (
              <Badge key={i}>{r}</Badge>
            ))}
          </div>
        </div>
      )}

      {intent.missing_context.length > 0 && (
        <div>
          <div style={s.colTitle}>{t("missingContextTitle")}</div>
          <Bullets items={intent.missing_context} none={t("noneListed")} />
        </div>
      )}

      <div>
        <div style={s.colTitle}>{t("sources")}</div>
        <ul style={s.sourceList}>
          {intent.sources.map((src, i) => (
            <li key={i} style={s.sourceRow}>
              <span style={s.sourceStatus(statusColor(src.status))}>{t(`status.${src.status}`)}</span>
              <span>{t(`kind.${src.kind}`)}</span>
              {/* Rendered as text, never as a link: refs come from the PR body. */}
              <span className="mono" style={s.sourceRef}>
                {src.ref}
              </span>
              {src.reason && <span style={s.sourceReason}>— {src.reason}</span>}
            </li>
          ))}
        </ul>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.footer}>
        <span className="mono">{intent.model ?? "—"}</span>
        {intent.tokens_in != null && intent.tokens_out != null && (
          <span>{formatTokens(intent.tokens_in, intent.tokens_out)}</span>
        )}
        {intent.cost_usd != null && <span>{formatCost(intent.cost_usd)}</span>}
      </div>
    </div>
  );
}

export function IntentCard({ prId }: { prId: string | null }) {
  const t = useTranslations("intent");
  const { data, isLoading, isError, refetch } = usePrIntent(prId);
  const detect = useDetectIntent(prId);
  const detectError =
    detect.error == null ? null : detect.error instanceof ApiError ? detect.error.message : t("detectFailed");

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton height={120} />;
  } else if (isError) {
    body = (
      <div style={s.card}>
        <div style={s.center}>
          <p style={s.error}>{t("loadFailed")}</p>
          <Button kind="secondary" size="sm" icon="RefreshCw" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  } else if (data?.intent) {
    body = (
      <Populated
        intent={data.intent}
        detecting={detect.isPending}
        onDetect={() => detect.mutate()}
        error={detectError}
      />
    );
  } else {
    body = (
      <div style={s.card}>
        <div style={s.center}>
          <p style={s.muted}>
            <strong>{t("emptyTitle")}</strong> — {t("emptyBody")}
          </p>
          <Button kind="primary" size="sm" icon="Sparkles" loading={detect.isPending} disabled={detect.isPending || !prId} onClick={() => detect.mutate()}>
            {detect.isPending ? t("detecting") : t("detect")}
          </Button>
          {detectError && <p style={s.error}>{detectError}</p>}
        </div>
      </div>
    );
  }

  return (
    <section>
      <SectionLabel icon="Target">{t("title")}</SectionLabel>
      {body}
    </section>
  );
}
