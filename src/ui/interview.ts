import { describeValue, type Question } from '../questions/bank.js';
import { prefill, type Batch } from '../questions/engine.js';
import type { AnswerValue, Project } from '../types.js';

// ───────────────────────── Elicitation (native form popups) ─────────────────────────

type FieldSchema = Record<string, unknown>;

/**
 * Build a flat form schema. Multi-select questions become one boolean per option because
 * array/multi-select fields are not supported by every client yet.
 */
export function buildFormSchema(p: Project, batch: Batch): { type: 'object'; properties: Record<string, FieldSchema>; required?: string[] } {
  const properties: Record<string, FieldSchema> = {};
  const required: string[] = [];
  for (const q of batch.questions) {
    const pre = prefill(p, q);
    const description = `${q.text}${q.unit ? ` (${q.unit})` : ''} — ${q.why}`;
    switch (q.type) {
      case 'single':
        properties[q.id] = {
          type: 'string',
          title: q.short,
          description,
          enum: q.options!.map((o) => o.value),
          enumNames: q.options!.map((o) => o.label),
          ...(typeof pre === 'string' ? { default: pre } : {}),
        };
        required.push(q.id);
        break;
      case 'multi': {
        const chosen = Array.isArray(pre) ? pre : [];
        for (const o of q.options!) {
          properties[`${q.id}__${o.value}`] = {
            type: 'boolean',
            title: `${q.short}: ${o.label}`,
            description: o === q.options![0] ? description : undefined,
            default: chosen.includes(o.value),
          };
        }
        break;
      }
      case 'number':
        properties[q.id] = {
          type: 'number',
          title: q.short + (q.unit ? ` (${q.unit})` : ''),
          description,
          ...(q.min !== undefined ? { minimum: q.min } : {}),
          ...(q.max !== undefined ? { maximum: q.max } : {}),
          ...(typeof pre === 'number' ? { default: pre } : {}),
        };
        if (!q.optional) required.push(q.id);
        break;
      case 'boolean':
        properties[q.id] = { type: 'boolean', title: q.short, description, ...(typeof pre === 'boolean' ? { default: pre } : {}) };
        break;
      case 'text':
        properties[q.id] = {
          type: 'string',
          title: q.short,
          description,
          ...(typeof pre === 'string' ? { default: pre } : {}),
        };
        if (!q.optional) required.push(q.id);
        break;
    }
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

export function formMessage(p: Project, batch: Batch): string {
  const follow = batch.followUp ? ' · follow-up questions based on your earlier answers' : '';
  return `${p.name} — ${batch.roundLabel} (step ${batch.roundIndex} of ${batch.roundTotal})${follow}`;
}

/** Turn form content back into {id, value} answers. */
export function parseFormContent(batch: Batch, content: Record<string, unknown>): { id: string; value: unknown }[] {
  const out: { id: string; value: unknown }[] = [];
  for (const q of batch.questions) {
    if (q.type === 'multi') {
      const vals = q.options!.filter((o) => content[`${q.id}__${o.value}`] === true).map((o) => o.value);
      out.push({ id: q.id, value: vals });
    } else if (content[q.id] !== undefined) {
      out.push({ id: q.id, value: content[q.id] });
    } else if (q.optional) {
      out.push({ id: q.id, value: '' });
    }
  }
  return out;
}

// ───────────────────────── Chat fallback ─────────────────────────

function typeHint(q: Question): string {
  switch (q.type) {
    case 'single':
      return 'choose ONE';
    case 'multi':
      return 'choose ANY (zero or more)';
    case 'number':
      return `number${q.unit ? ` in ${q.unit}` : ''}`;
    case 'boolean':
      return 'yes / no';
    case 'text':
      return 'free text';
  }
}

export function formatQuestionsForChat(p: Project, batch: Batch, remainingAfter: number): string {
  const L: string[] = [];
  L.push(`## Archforge interview — ${batch.roundLabel} (step ${batch.roundIndex} of ${batch.roundTotal})`);
  L.push(`Project: **${p.name}** · id \`${p.id}\`${batch.followUp ? ' · includes follow-ups based on earlier answers' : ''}`);
  L.push('');
  L.push('**INSTRUCTIONS FOR THE ASSISTANT (do not skip):**');
  L.push('1. Show the questions below to the user as a numbered list, keeping the options and suggested values. Do NOT answer for the user.');
  L.push(
    `2. When the user replies, map each reply to the question \`id\` and call \`archforge_submit_answers\` with projectId "${p.id}" and answers [{id, value}] ` +
      '(single → the option key; multi → array of option keys; number → number; text → string).',
  );
  L.push('3. If the user says "use defaults"/"you decide" for some questions, pass their ids in `useDefaultsFor`; for everything, pass `acceptAllDefaults: true`. Say clearly which values were assumed.');
  L.push('4. If the user says a suggested/inferred value is right, pass `confirmInferred: true` or re-send that value.');
  L.push('');
  batch.questions.forEach((q, i) => {
    L.push(`**${i + 1}. ${q.text}**  \`${q.id}\` — ${typeHint(q)}${q.optional ? ', optional' : ''}`);
    if (q.options) q.options.forEach((o) => L.push(`   - \`${o.value}\` — ${o.label}`));
    const pre = prefill(p, q);
    if (pre !== undefined) {
      const src = p.answers[q.id]?.source === 'inferred' ? 'inferred from your description — please confirm' : 'default';
      L.push(`   - Suggested (${src}): **${describeValue(q, pre as AnswerValue)}**`);
    }
    L.push(`   - _Why we ask: ${q.why}_`);
    L.push('');
  });
  if (remainingAfter > 0) L.push(`_(${remainingAfter} more question(s) will follow in later steps; some may be added or removed depending on these answers.)_`);
  return L.join('\n');
}

export function catalogForInference(): (q: Question) => string {
  return (q) => {
    const opts = q.options ? ` [${q.options.map((o) => o.value).join(' | ')}]` : '';
    return `- ${q.id} (${q.type}${q.unit ? ', ' + q.unit : ''}${q.optional ? ', optional' : ''}): ${q.short}${opts}`;
  };
}
