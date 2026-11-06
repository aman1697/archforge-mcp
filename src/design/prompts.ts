import { capacityMarkdown, type CapacityReport } from '../capacity.js';
import { ROUNDS, describeValue } from '../questions/bank.js';
import { applicableQuestions } from '../questions/engine.js';
import type { Project } from '../types.js';
import { SECTION_BY_ID, STYLE_RULES, type SectionDef } from './sections.js';

export const SYSTEM_PROMPT = STYLE_RULES.join('\n');

/** Requirements as markdown, grouped by interview round. */
export function requirementsMarkdown(p: Project): string {
  const out: string[] = [];
  const applicable = applicableQuestions(p);
  for (const r of ROUNDS) {
    const rows: string[] = [];
    for (const q of applicable.filter((x) => x.round === r.id)) {
      const a = p.answers[q.id];
      if (!a) continue;
      const tag = a.source === 'default' ? ' *(assumed default)*' : a.source === 'inferred' ? ' *(inferred — unconfirmed)*' : '';
      rows.push(`- **${q.short}:** ${describeValue(q, a.value)}${tag}`);
    }
    if (rows.length) out.push(`### ${r.label}`, ...rows, '');
  }
  return out.join('\n').trim();
}

export function assumptionList(p: Project): string[] {
  return applicableQuestions(p)
    .filter((q) => p.answers[q.id] && p.answers[q.id].source !== 'user')
    .map((q) => {
      const a = p.answers[q.id];
      return `${q.short}: ${describeValue(q, a.value)} (${a.source === 'default' ? 'assumed default' : 'inferred, unconfirmed'})`;
    });
}

export function contextPack(p: Project, capacity: CapacityReport): string {
  return [
    `# Project: ${p.name}`,
    p.description.trim(),
    '',
    '## Requirements gathered',
    requirementsMarkdown(p),
    '',
    '## Capacity estimates (deterministic — use these numbers)',
    capacityMarkdown(capacity),
  ].join('\n');
}

const DEP_LIMIT = 5000;

export function dependencyContext(def: SectionDef, p: Project): string {
  const parts: string[] = [];
  for (const id of def.dependsOn ?? []) {
    const s = p.sections[id];
    const d = SECTION_BY_ID[id];
    if (!s || !d || d.kind === 'computed') continue;
    const body = s.content.length > DEP_LIMIT ? s.content.slice(0, DEP_LIMIT) + '\n…(truncated)' : s.content;
    parts.push(`#### Already written: ${d.title} [${id}]\n${body}`);
  }
  return parts.join('\n\n');
}

export function diagramRequirement(def: SectionDef): string {
  if (!def.diagrams?.length) return 'No diagram is required for this section (add one only if it clearly helps).';
  return (
    'REQUIRED_DIAGRAMS: ' +
    def.diagrams.map((d) => `${d.type}${d.min && d.min > 1 ? ` ×${d.min}` : ''}`).join(', ') +
    ' — each as a separate ```mermaid block.'
  );
}

export function sectionBrief(def: SectionDef, p: Project, opts: { feedback?: string } = {}): string {
  const lines = [`### [${def.id}] ${def.title}`, '', def.instruction, '', diagramRequirement(def)];
  const deps = dependencyContext(def, p);
  if (deps) lines.push('', '**Builds on (keep consistent with it):**', '', deps);
  const existing = p.sections[def.id];
  if (opts.feedback) {
    lines.push('', `**Revision requested by the user:** ${opts.feedback}`);
    if (existing) lines.push('', '**Current draft to revise:**', '', existing.content.slice(0, 12000));
  }
  return lines.join('\n');
}

export function buildPrompt(
  def: SectionDef,
  p: Project,
  capacity: CapacityReport,
  opts: { feedback?: string; previous?: { content: string; issues: string[] } } = {},
): { system: string; prompt: string } {
  const lines = [
    contextPack(p, capacity),
    '',
    '---',
    '',
    `Write the section "${def.title}" now.`,
    '',
    sectionBrief(def, p, { feedback: opts.feedback }),
  ];
  if (opts.previous) {
    lines.push(
      '',
      '---',
      'Your previous attempt was rejected by automatic validation. Fix ALL of these problems and output the complete corrected section:',
      ...opts.previous.issues.map((i) => `- ${i}`),
      '',
      'Previous attempt:',
      opts.previous.content.slice(0, 20000),
    );
  }
  return { system: SYSTEM_PROMPT, prompt: lines.join('\n') };
}

