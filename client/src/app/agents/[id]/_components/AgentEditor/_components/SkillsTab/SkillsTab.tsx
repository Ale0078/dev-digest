/* SkillsTab — every workspace skill for this agent: linked first (in order),
   then unlinked unchecked. Checkbox = link enabled; drag (native HTML5) sets
   the order; skills disabled globally are greyed. Save persists every row. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Checkbox, EmptyState, Icon, Skeleton } from "@devdigest/ui";
import { GripVertical } from "lucide-react";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills, useSkills } from "../../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../../lib/toast";
import { SkillTypeBadge } from "../../../../../../../components/skill-badges";
import { buildRows, moveRow, reconcileRows, sameRows, toggleRow, type SkillRow } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const toast = useToast();
  const { data: skills, isLoading: skillsLoading } = useSkills();
  const { data: links, isLoading: linksLoading } = useAgentSkills(agent.id);
  const save = useSetAgentSkills();
  // null = no local edits; show the server state.
  const [edited, setEdited] = React.useState<SkillRow[] | null>(null);
  const [filter, setFilter] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);

  if (skillsLoading || linksLoading) return <Skeleton height={180} />;
  const allSkills = skills ?? [];
  const serverRows = buildRows(allSkills, links ?? []);
  const rows = edited ? reconcileRows(edited, allSkills) : serverRows;
  const dirty = !sameRows(rows, serverRows);
  const byId = new Map(allSkills.map((sk) => [sk.id, sk]));
  const q = filter.trim().toLowerCase();
  const visible = q ? rows.filter((r) => byId.get(r.skill_id)?.name.toLowerCase().includes(q)) : rows;
  const enabledCount = rows.filter((r) => r.enabled).length;

  const persist = () =>
    save.mutate(
      { agentId: agent.id, items: rows.map((r) => ({ skill_id: r.skill_id, enabled: r.enabled })) },
      {
        onSuccess: () => {
          setEdited(null);
          toast.success(t("skills.savedToast"));
        },
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span className="tnum" style={s.counter}>
          {t("skills.enabledCount", { linked: enabledCount, total: rows.length })}
        </span>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {allSkills.length === 0 ? (
        <EmptyState icon="Sparkles" title={t("skills.emptyTitle")} body={t("skills.emptyBody")} />
      ) : (
        <>
          <div style={s.filter}>
            <Icon.Filter size={13} style={s.filterIcon} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("skills.filterPlaceholder")}
              aria-label={t("skills.filterPlaceholder")}
              style={s.filterInput}
            />
          </div>
          <ul style={s.list}>
            {visible.map((r) => {
              const sk = byId.get(r.skill_id);
              if (!sk) return null;
              const off = !sk.enabled;
              return (
                <li
                  key={r.skill_id}
                  data-testid={`skill-row-${r.skill_id}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) setEdited(moveRow(rows, dragId, r.skill_id));
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  style={s.row(dragId === r.skill_id, off)}
                >
                  {/* Only the grip is draggable: a draggable row turns a click with a few
                      pixels of mouse movement into a drag and swallows the checkbox click. */}
                  <span
                    aria-hidden="true"
                    draggable
                    data-testid={`skill-drag-${r.skill_id}`}
                    onDragStart={(e) => {
                      setDragId(r.skill_id);
                      e.dataTransfer?.setData("text/plain", r.skill_id);
                    }}
                    style={s.handle}
                  >
                    <GripVertical size={14} />
                  </span>
                  <div style={s.check}>
                    <Checkbox
                      checked={r.enabled}
                      onChange={() => setEdited(toggleRow(rows, r.skill_id))}
                      label={<span style={s.name}>{sk.name}</span>}
                    />
                  </div>
                  {off && <span style={s.offHint}>{t("skills.disabledGlobally")}</span>}
                  <SkillTypeBadge type={sk.type} />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={persist} disabled={!dirty || save.isPending}>
          {save.isPending ? t("skills.saving") : t("skills.save")}
        </Button>
      </div>
    </div>
  );
}
