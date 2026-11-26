/**
 * Skills (M2): renderSkillBlock format + placement of the `## Skills` block in
 * the SYSTEM message (after the agent prompt, before the injection guard).
 */
import { describe, it, expect } from 'vitest';
import { assemblePrompt, renderSkillBlock } from '../src/prompt.js';

const A = renderSkillBlock({ name: 'alpha', description: 'Apply always.', body: 'Body A' });
const B = renderSkillBlock({ name: 'beta', description: 'Apply on tests.', body: 'Body B' });

describe('renderSkillBlock', () => {
  it('renders `### name`, description, blank line, body — exactly', () => {
    expect(A).toBe('### alpha\nApply always.\n\nBody A');
  });
});

describe('assemblePrompt — ## Skills', () => {
  it('puts skills in the system message between the agent prompt and the guard', () => {
    const { messages } = assemblePrompt({ system: 'AGENT-SYS', diff: 'DIFF', skills: [A] });
    const sys = messages[0]!.content;
    expect(sys.startsWith('AGENT-SYS\n\n## Skills\n### alpha')).toBe(true);
    expect(sys.indexOf('## Skills')).toBeLessThan(sys.indexOf('SECURITY'));
    expect(messages[1]!.content).not.toContain('alpha');
  });

  it('keeps the given order', () => {
    const sys = assemblePrompt({ system: 's', diff: 'd', skills: [B, A] }).messages[0]!.content;
    expect(sys.indexOf('### beta')).toBeLessThan(sys.indexOf('### alpha'));
  });

  it('is byte-identical to the no-skills prompt when skills are empty or absent', () => {
    const base = assemblePrompt({ system: 's', diff: 'd', task: 't' });
    const empty = assemblePrompt({ system: 's', diff: 'd', task: 't', skills: [] });
    expect(empty.messages).toEqual(base.messages);
    expect(base.messages[0]!.content).not.toContain('## Skills');
    expect(base.assembly.skills).toBeNull();
  });

  it('records the skills block separately in the assembly (system excludes it)', () => {
    const { assembly } = assemblePrompt({ system: 's', diff: 'd', skills: [A, B] });
    expect(assembly.skills).toBe(`${A}\n\n${B}`);
    expect(assembly.system).not.toContain('## Skills');
  });
});
