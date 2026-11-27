import type { ConventionCandidate } from "@devdigest/shared";

/** Same rule as the server's `POST /repos/:id/conventions/skills` name check. */
export function isSlug(name: string): boolean {
  return name.length > 0 && name.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

function location(c: ConventionCandidate): string {
  if (c.evidence_line_start == null) return c.evidence_path;
  return `${c.evidence_path}:${c.evidence_line_start}-${c.evidence_line_end ?? c.evidence_line_start}`;
}

/**
 * The default skill body merged from the chosen conventions. This is prompt
 * text for the reviewer model (not UI copy), so it is built here, not in
 * messages. The user can edit it freely before saving.
 */
export function buildSkillBody(
  name: string,
  repoName: string,
  conventions: ConventionCandidate[],
): string {
  const parts = [
    `# ${name || "repo-conventions"}`,
    `House conventions detected in \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.`,
  ];
  conventions.forEach((c, i) => {
    const fence = c.evidence_snippet.includes("```") ? "~~~" : "```";
    parts.push(
      [`## ${i + 1}. ${c.rule}`, `Detected in \`${location(c)}\`:`, fence, c.evidence_snippet, fence].join(
        "\n",
      ),
    );
  });
  return parts.join("\n\n") + "\n";
}
