// Generates docs/QUESTIONS.md and docs/SECTIONS.md from the compiled source of truth.
// Run with:  npm run docs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { QUESTIONS, ROUNDS } = await import(path.join(root, 'dist/questions/bank.js'));
const { SECTIONS } = await import(path.join(root, 'dist/design/sections.js'));

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const defaultText = (q) => {
  if (q.default === undefined) return q.optional ? '— (optional, may be left blank)' : '— (required)';
  const lab = (v) => q.options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(q.default)) return q.default.length ? q.default.map(lab).join(', ') : 'none';
  return typeof q.default === 'string' ? lab(q.default) : `${q.default}${q.unit ? ' ' + q.unit : ''}`;
};

// ── QUESTIONS.md
const conditional = QUESTIONS.filter((q) => q.when).length;
let md = `# Interview question catalog

> Generated from \`src/questions/bank.ts\` by \`npm run docs\`. Do not edit by hand.

Archforge asks **${QUESTIONS.length} questions** in ${ROUNDS.length} rounds: **${QUESTIONS.length - conditional} are always asked** and **${conditional} are follow-ups** that only appear when an earlier answer makes them relevant (marked *follow-up* below).
Every question has a default; anything you leave on its default is recorded as an **assumption** and listed in the exported README.

`;
ROUNDS.forEach((r, i) => {
  md += `## Round ${i + 1} — ${r.label}\n\n`;
  for (const q of QUESTIONS.filter((x) => x.round === r.id)) {
    md += `### \`${q.id}\` — ${q.text}${q.when ? '  *(follow-up)*' : ''}\n\n`;
    md += `- **Type:** ${q.type}${q.unit ? ` (${q.unit})` : ''}${q.optional ? ', optional' : ''}\n`;
    md += `- **Why it is asked:** ${q.why}\n`;
    md += `- **Default:** ${defaultText(q)}\n`;
    if (q.options) {
      md += `- **Options:**\n`;
      for (const o of q.options) md += `  - \`${o.value}\` — ${o.label}\n`;
    }
    md += '\n';
  }
});
fs.writeFileSync(path.join(root, 'docs/QUESTIONS.md'), md);

// ── SECTIONS.md
const hld = SECTIONS.filter((s) => s.level === 'hld');
const lld = SECTIONS.filter((s) => s.level === 'lld');
let sm = `# Generated document sections

> Generated from \`src/design/sections.ts\` by \`npm run docs\`. Do not edit by hand.

Archforge writes **${SECTIONS.length} sections**: ${hld.length} for the High-Level Design (HLD) and ${lld.length} for the Low-Level Design (LLD).
"Computed" sections are produced by code; all others are written by a language model and then validated.
"Builds on" lists the earlier sections whose text is passed to the model so the document stays consistent.

`;
for (const [name, list] of [['High-Level Design (hld.md)', hld], ['Low-Level Design (lld.md)', lld]]) {
  sm += `## ${name}\n\n| # | Section id | Title | Required diagrams | Builds on | Written by |\n|---|---|---|---|---|---|\n`;
  list.forEach((s, i) => {
    const dg = (s.diagrams ?? []).map((d) => `${d.type}${d.min && d.min > 1 ? ` ×${d.min}` : ''}`).join(', ') || '—';
    sm += `| ${i + 1} | \`${s.id}\` | ${cell(s.title)} | ${dg} | ${(s.dependsOn ?? []).map((d) => `\`${d}\``).join(', ') || '—'} | ${s.kind === 'computed' ? 'code (computed)' : 'LLM'} |\n`;
  });
  sm += '\n';
}
sm += `## What each section is asked to contain\n\n`;
for (const s of SECTIONS.filter((x) => x.kind === 'llm')) sm += `### \`${s.id}\` — ${s.title}\n\n${s.instruction}\n\n`;
fs.writeFileSync(path.join(root, 'docs/SECTIONS.md'), sm);
console.log(`docs/QUESTIONS.md (${QUESTIONS.length} questions) and docs/SECTIONS.md (${SECTIONS.length} sections) written`);
