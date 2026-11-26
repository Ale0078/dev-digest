/* AgentCardWithSkills — AgentCard plus its `N skills` count (enabled links),
   fetched per card via useAgentSkills. Keeps AgentCard itself presentational. */
"use client";

import React from "react";
import { useAgentSkillCount } from "../../../../lib/hooks/skills";
import { AgentCard } from "../AgentCard";

export function AgentCardWithSkills(props: Omit<React.ComponentProps<typeof AgentCard>, "skillCount">) {
  const skillCount = useAgentSkillCount(props.ag.id);
  return <AgentCard {...props} skillCount={skillCount} />;
}
