import type { AnswerSource, AnswerValue, Project } from '../types.js';
import { QUESTIONS, QUESTION_BY_ID, ROUNDS, parseAnswer, type AnswerMap, type Question, type Round } from './bank.js';

/** Values of every stored answer (including inferred ones). */
export function answerMap(p: Project): AnswerMap {
  const m: AnswerMap = {};
  for (const [id, a] of Object.entries(p.answers)) m[id] = a.value;
  return m;
}

export function applicableQuestions(p: Project): Question[] {
  const a = answerMap(p);
  return QUESTIONS.filter((q) => !q.when || q.when(a));
}

/**
 * A question is pending when it applies and either has no answer yet, or only has an
 * *inferred* answer that the user has not confirmed. Skipped optional questions are not pending.
 */
export function pendingQuestions(p: Project): Question[] {
  return applicableQuestions(p).filter((q) => {
    if (p.skipped.includes(q.id)) return false;
    const a = p.answers[q.id];
    return !a || a.source === 'inferred';
  });
}

export interface Batch {
  round: Round;
  roundLabel: string;
  roundIndex: number;
  roundTotal: number;
  questions: Question[];
  /** true when some of these questions only became relevant because of earlier answers */
  followUp: boolean;
}

export function nextBatch(p: Project, max: number): Batch | null {
  const pending = pendingQuestions(p);
  if (!pending.length) return null;
  const roundOrder = ROUNDS.map((r) => r.id);
  const first = pending.reduce((best, q) => (roundOrder.indexOf(q.round) < roundOrder.indexOf(best.round) ? q : best));
  const round = first.round;
  const inRound = pending.filter((q) => q.round === round).slice(0, Math.max(1, max));
  const idx = roundOrder.indexOf(round);
  const answeredInRound = Object.entries(p.answers).some(([id, a]) => a.source !== 'inferred' && QUESTION_BY_ID[id]?.round === round);
  return {
    round,
    roundLabel: ROUNDS[idx].label,
    roundIndex: idx + 1,
    roundTotal: ROUNDS.length,
    questions: inRound,
    followUp: answeredInRound,
  };
}

/** Value to pre-fill: inferred answer if present, otherwise the question default. */
export function prefill(p: Project, q: Question): AnswerValue | undefined {
  return p.answers[q.id]?.value ?? q.default;
}

export interface ApplyResult {
  applied: string[];
  errors: { id: string; error: string }[];
}

export function setAnswer(p: Project, q: Question, value: AnswerValue, source: AnswerSource): boolean {
  const prev = p.answers[q.id];
  const changed = !prev || JSON.stringify(prev.value) !== JSON.stringify(value);
  p.answers[q.id] = { value, source, at: new Date().toISOString() };
  p.skipped = p.skipped.filter((id) => id !== q.id);
  if (changed) p.answersVersion += 1;
  return changed;
}

export function applyAnswers(
  p: Project,
  items: { id: string; value: unknown }[],
  source: AnswerSource,
): ApplyResult {
  const res: ApplyResult = { applied: [], errors: [] };
  for (const it of items) {
    const q = QUESTION_BY_ID[it.id];
    if (!q) {
      res.errors.push({ id: it.id, error: 'Unknown question id.' });
      continue;
    }
    if (q.type === 'text' && q.optional && (it.value === '' || it.value === null || it.value === undefined)) {
      if (!p.skipped.includes(q.id)) p.skipped.push(q.id);
      res.applied.push(q.id);
      continue;
    }
    if (q.optional && q.type === 'number' && (it.value === '' || it.value === null || it.value === undefined || it.value === 0)) {
      if (!p.skipped.includes(q.id)) p.skipped.push(q.id);
      res.applied.push(q.id);
      continue;
    }
    const parsed = parseAnswer(q, it.value);
    if (!parsed.ok) {
      res.errors.push({ id: it.id, error: parsed.error });
      continue;
    }
    setAnswer(p, q, parsed.value, source);
    res.applied.push(q.id);
  }
  return res;
}

/**
 * Accept defaults for the given question ids (or all pending ones). Repeats until no new
 * follow-up questions appear. Optional questions without a default are skipped.
 */
export function applyDefaults(p: Project, ids: string[] | 'all'): string[] {
  const done: string[] = [];
  for (let guard = 0; guard < 10; guard++) {
    const targets = pendingQuestions(p).filter((q) => ids === 'all' || ids.includes(q.id));
    if (!targets.length) break;
    for (const q of targets) {
      const existing = p.answers[q.id];
      if (existing?.source === 'inferred') {
        // accepting "defaults" for an inferred answer means confirming it
        setAnswer(p, q, existing.value, 'user');
      } else if (q.default !== undefined) {
        setAnswer(p, q, q.default, 'default');
      } else if (!p.skipped.includes(q.id)) {
        p.skipped.push(q.id);
      }
      done.push(q.id);
    }
    if (ids !== 'all') break;
  }
  return done;
}

/** Convert all inferred answers to user-confirmed. */
export function confirmInferred(p: Project): number {
  let n = 0;
  for (const a of Object.values(p.answers)) {
    if (a.source === 'inferred') {
      a.source = 'user';
      n++;
    }
  }
  return n;
}

export function progress(p: Project): { answered: number; total: number; pending: number } {
  const applicable = applicableQuestions(p);
  const pending = pendingQuestions(p).length;
  return { answered: applicable.length - pending, total: applicable.length, pending };
}
