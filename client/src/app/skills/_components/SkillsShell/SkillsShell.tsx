/* SkillsShell — master–detail frame for every /skills route: left list (search,
   Add menu → Create skill / Import from file, SkillCards with the global
   toggle) and the right pane passed as children. Owns the import drawer. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton, type Crumb } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "../../../../components/app-shell";
import { useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { useToast } from "../../../../lib/toast";
import { SkillCard } from "../SkillCard";
import { ImportDrawer } from "../ImportDrawer";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsShell({
  crumb,
  activeId,
  tab,
  children,
}: {
  crumb: Crumb[];
  activeId?: string;
  /** Detail tab to keep when switching skills. */
  tab?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const list = filterSkills(skills ?? [], search);

  const onImported = (skill: Skill) => {
    setImporting(false);
    toast.success(t("import.savedToast", { name: skill.name }));
    router.push(`/skills/${skill.id}?tab=config`);
  };

  return (
    <AppShell crumb={crumb}>
      {importing && <ImportDrawer onClose={() => setImporting(false)} onImported={onImported} />}
      <div style={s.frame}>
        <aside style={s.sidebar}>
          <div style={s.sidebarHead}>
            <div style={s.titleRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <Dropdown
                width={210}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                    {t("page.addSkill")}
                  </Button>
                }
                items={[
                  { label: t("page.menu.create"), icon: "Edit", onClick: () => router.push("/skills/new") },
                  { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setImporting(true) },
                ]}
              />
            </div>
            <div style={s.search}>
              <Icon.Search size={13} style={s.searchIcon} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                aria-label={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>
          <div style={s.listScroll}>
            {isLoading && (
              <>
                <Skeleton height={96} />
                <div style={s.gap} />
                <Skeleton height={96} />
              </>
            )}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {!isLoading && !isError && (skills ?? []).length === 0 && (
              <EmptyState
                icon="Sparkles"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => router.push("/skills/new")}
              />
            )}
            {(skills ?? []).length > 0 && list.length === 0 && (
              <div style={s.noMatch}>{t("page.noMatch", { q: search })}</div>
            )}
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === activeId}
                onClick={() => router.push(`/skills/${sk.id}?tab=${tab ?? "config"}`)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        </aside>
        <section style={s.detail}>{children}</section>
      </div>
    </AppShell>
  );
}
