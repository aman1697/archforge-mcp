import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { capacityMarkdown, estimateCapacity } from './capacity.js';
import { configPath, defaultApiKeyEnv, defaultBaseUrl, homeDir, loadConfig, loadFileConfig, saveConfig, } from './config.js';
import { lintSection } from './design/diagrams.js';
import { SYSTEM_PROMPT, assumptionList, buildPrompt, contextPack, sectionBrief } from './design/prompts.js';
import { writeExport } from './design/render.js';
import { SECTIONS, SECTION_BY_ID, sectionsFor } from './design/sections.js';
import { buildProvider, clientSupportsElicitation, clientSupportsSampling, resolveLlm } from './llm/index.js';
import { QUESTIONS } from './questions/bank.js';
import { answerMap, applyAnswers, applyDefaults, confirmInferred as confirmAllInferred, nextBatch, pendingQuestions, progress, } from './questions/engine.js';
import { Store } from './store.js';
import { buildFormSchema, catalogForInference, formMessage, formatQuestionsForChat, parseFormContent } from './ui/interview.js';
const VERSION = '0.1.0';
const INSTRUCTIONS = [
    'Archforge designs an application end to end: an adaptive requirements interview, deterministic capacity estimates, then a full HLD + LLD with Mermaid diagrams, exported as Markdown into the workspace.',
    'Workflow: (1) archforge_start_project with the user\'s idea. (2) Optionally pre-fill answers the idea clearly implies using archforge_submit_answers with source "inferred". (3) archforge_ask to interview the user (native form or chat). NEVER answer interview questions on the user\'s behalf. (4) archforge_generate_design — repeat until it reports completion. In "host authoring" mode you write the sections it hands you and submit them with archforge_submit_sections. (5) archforge_export.',
    'Use archforge_status to resume or inspect a project and archforge_config to choose which model writes the documents (the IDE\'s model, Claude API, or Ollama).',
].join('\n');
const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
const errMsg = (e) => (e instanceof Error ? e.message : String(e));
export function createServer() {
    const server = new McpServer({ name: 'archforge', version: VERSION }, { instructions: INSTRUCTIONS });
    const store = new Store(path.join(homeDir(), 'projects'));
    const getProject = (id) => {
        const p = store.get(id);
        if (!p) {
            const known = store.list().map((x) => x.id);
            throw new Error(`No project with id "${id}".${known.length ? ` Known projects: ${known.join(', ')}.` : ' Create one with archforge_start_project.'}`);
        }
        return p;
    };
    // ───────────────────────── helpers ─────────────────────────
    async function workspaceRoot() {
        if (!server.server.getClientCapabilities()?.roots)
            return undefined;
        try {
            const r = await server.server.listRoots(undefined, { timeout: 3000 });
            const uri = r.roots?.[0]?.uri;
            if (uri?.startsWith('file:'))
                return fileURLToPath(uri);
        }
        catch {
            /* ignore */
        }
        return undefined;
    }
    function notify(extra, progressValue, total, message) {
        const token = extra?._meta?.progressToken;
        if (token === undefined)
            return;
        extra
            .sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: progressValue, total, message } })
            .catch(() => undefined);
    }
    function nextStep(p) {
        if (pendingQuestions(p).length)
            return 'Next: call archforge_ask to continue the interview.';
        const llm = SECTIONS.filter((d) => d.kind === 'llm');
        const missing = llm.filter((d) => !p.sections[d.id]);
        const stale = SECTIONS.filter((d) => p.sections[d.id] && p.sections[d.id].answersVersion < p.answersVersion);
        if (missing.length)
            return `Next: call archforge_generate_design (${missing.length} section(s) not written yet).`;
        if (stale.length)
            return `Next: requirements changed since ${stale.length} section(s) were written — call archforge_generate_design with regenerate:"stale", or export as is.`;
        return 'Next: call archforge_export to write the documents into the workspace.';
    }
    function completionMessage(p, notes) {
        const prog = progress(p);
        const assumed = assumptionList(p);
        const L = [
            ...notes.map((n) => `ℹ️ ${n}`),
            `✅ Interview complete for "${p.name}" — ${prog.total} question(s) covered.`,
        ];
        if (assumed.length) {
            L.push('', 'Assumptions that came from defaults (tell the user; they are listed in the generated docs too):', ...assumed.map((a) => `- ${a}`));
        }
        L.push('', 'Next: call archforge_generate_design with this projectId (repeat until it reports completion), then archforge_export.');
        return L.join('\n');
    }
    // ───────────────────────── interview flow ─────────────────────────
    async function runInterview(p, override) {
        const cfg = loadConfig();
        const canElicit = clientSupportsElicitation(server);
        let mode = override ?? cfg.ui.questionMode;
        const notes = [];
        if (mode === 'auto')
            mode = canElicit && p.uiMode !== 'chat' ? 'elicit' : 'chat';
        if (mode === 'elicit' && !canElicit) {
            notes.push('This IDE does not support popup forms — using chat questions.');
            mode = 'chat';
        }
        if (mode === 'elicit') {
            for (let guard = 0; guard < 40; guard++) {
                const batch = nextBatch(p, cfg.ui.maxQuestionsPerBatch);
                if (!batch)
                    break;
                let res;
                try {
                    res = await server.server.elicitInput({ message: formMessage(p, batch), requestedSchema: buildFormSchema(p, batch) }, { timeout: 30 * 60 * 1000 });
                }
                catch (e) {
                    notes.push(`The popup form failed (${errMsg(e)}); continuing with chat questions.`);
                    p.uiMode = 'chat';
                    break;
                }
                if (res.action === 'accept') {
                    const r = applyAnswers(p, parseFormContent(batch, (res.content ?? {})), 'user');
                    store.save(p);
                    if (r.errors.length) {
                        notes.push(`Some form answers were invalid (${r.errors.map((x) => `${x.id}: ${x.error}`).join('; ')}); asking those again in chat.`);
                        p.uiMode = 'chat';
                        break;
                    }
                    continue;
                }
                if (res.action === 'decline') {
                    notes.push('The user declined the popup form — switching to chat questions for the rest of this project.');
                    p.uiMode = 'chat';
                    break;
                }
                store.save(p);
                return 'The user cancelled the questionnaire. Progress is saved. Ask whether they want to continue; if so call archforge_ask again (or archforge_submit_answers with acceptAllDefaults:true to proceed on defaults).';
            }
            store.save(p);
        }
        const batch = nextBatch(p, cfg.ui.maxQuestionsPerBatch);
        if (!batch)
            return completionMessage(p, notes);
        const remaining = pendingQuestions(p).length - batch.questions.length;
        return [...notes.map((n) => `ℹ️ ${n}`), notes.length ? '' : '', formatQuestionsForChat(p, batch, remaining)].join('\n');
    }
    // ───────────────────────── generation helpers ─────────────────────────
    async function generateOne(def, p, cap, provider, cfg, feedback) {
        let previous;
        let attempts = 0;
        for (let i = 0; i <= cfg.generation.maxRetries; i++) {
            attempts++;
            const { system, prompt } = buildPrompt(def, p, cap, { feedback, previous });
            const raw = await provider.complete({ system, prompt, maxTokens: cfg.llm.maxTokens });
            const lint = lintSection(def, raw);
            if (!lint.issues.length)
                return { content: lint.content, issues: [], attempts };
            previous = { content: lint.content, issues: lint.issues };
        }
        return { content: previous.content, issues: previous.issues, attempts };
    }
    function refreshComputed(p) {
        const cap = estimateCapacity(answerMap(p));
        for (const d of SECTIONS.filter((s) => s.kind === 'computed')) {
            p.sections[d.id] = {
                content: capacityMarkdown(cap),
                generatedBy: 'computed',
                answersVersion: p.answersVersion,
                updatedAt: new Date().toISOString(),
            };
        }
        return cap;
    }
    // ───────────────────────── tools ─────────────────────────
    server.registerTool('archforge_start_project', {
        title: 'Start an architecture project',
        description: 'Create a new architecture-design project from the user\'s app idea. Returns the project id and the catalog of interview question ids so you can pre-fill answers the idea clearly implies. Follow with archforge_ask.',
        inputSchema: {
            name: z.string().min(1).max(80).describe('Short project name, e.g. "FoodDash".'),
            description: z.string().min(5).describe('The user\'s idea / requirements in their own words (keep their wording; include every detail they gave).'),
        },
    }, async ({ name, description }) => {
        const p = store.create(name, description);
        const catalog = QUESTIONS.map(catalogForInference()).join('\n');
        return ok([
            `Project created: "${p.name}" (id: ${p.id}).`,
            '',
            'NEXT STEPS',
            '1. If the idea clearly implies answers to some questions below, submit ONLY those first with archforge_submit_answers {projectId, source:"inferred", answers:[{id,value}]}. The user will still see them pre-filled and confirm them. Never guess beyond what the idea states or strongly implies.',
            '2. Then call archforge_ask to interview the user. Never answer questions on the user\'s behalf.',
            '',
            'QUESTION CATALOG (ids / types / option keys):',
            catalog,
        ].join('\n'));
    });
    server.registerTool('archforge_ask', {
        title: 'Interview the user',
        description: 'Run or resume the requirements interview. If the IDE supports popup forms (MCP elicitation) the questions appear as native forms and this call returns when the user has answered; otherwise it returns a chat questionnaire you must show to the user, then submit their replies with archforge_submit_answers. Questions adapt to earlier answers (cloud, concurrent users, throughput, availability, compliance, …).',
        inputSchema: {
            projectId: z.string(),
            mode: z.enum(['auto', 'elicit', 'chat']).optional().describe('Force popup forms or chat questions. Default: auto.'),
        },
    }, async ({ projectId, mode }) => {
        try {
            const p = getProject(projectId);
            if (mode === 'chat')
                p.uiMode = 'chat';
            return ok(await runInterview(p, mode));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_submit_answers', {
        title: 'Submit interview answers',
        description: 'Record the user\'s answers (chat mode), pre-fill inferred answers, or accept defaults. Returns the next batch of questions (or announces that the interview is complete). Only submit values the user actually gave; use source "inferred" for values you deduced from their idea.',
        inputSchema: {
            projectId: z.string(),
            answers: z
                .array(z.object({
                id: z.string().describe('Question id, e.g. "cloud"'),
                value: z.any().describe('single → option key; multi → array of option keys; number → number (10k/1.5m allowed); text → string'),
            }))
                .optional(),
            source: z.enum(['user', 'inferred']).optional().describe('"inferred" = deduced from the idea, the user will confirm. Default "user".'),
            useDefaultsFor: z.array(z.string()).optional().describe('Question ids for which the user said "use the default / you decide".'),
            acceptAllDefaults: z.boolean().optional().describe('The user asked to accept defaults for everything remaining.'),
            confirmInferred: z.boolean().optional().describe('The user confirmed all inferred/pre-filled values as correct.'),
        },
    }, async (args) => {
        try {
            const p = getProject(args.projectId);
            const source = args.source ?? 'user';
            const lines = [];
            if (args.answers?.length) {
                const r = applyAnswers(p, args.answers, source);
                if (r.applied.length)
                    lines.push(`Recorded ${r.applied.length} answer(s) (${source}).`);
                if (r.errors.length)
                    lines.push('Could not record:', ...r.errors.map((x) => `- ${x.id}: ${x.error}`), 'These will be asked again.');
            }
            if (args.confirmInferred)
                lines.push(`Confirmed ${confirmAllInferred(p)} inferred answer(s).`);
            if (args.useDefaultsFor?.length) {
                const d = applyDefaults(p, args.useDefaultsFor);
                lines.push(`Used defaults for: ${d.join(', ') || '(none pending)'}.`);
            }
            if (args.acceptAllDefaults) {
                const d = applyDefaults(p, 'all');
                lines.push(`Accepted defaults for ${d.length} question(s); they will be listed as assumptions in the documents.`);
            }
            store.save(p);
            if (source === 'inferred') {
                lines.push('Inferred answers saved. Now call archforge_ask — the user will see them pre-filled and can confirm or change them.');
                return ok(lines.join('\n'));
            }
            const next = await runInterview(p);
            return ok([...lines, '', next].join('\n'));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_capacity', {
        title: 'Capacity estimate',
        description: 'Show the deterministic capacity estimate (RPS, storage, instances, availability budget, consistency warnings) for the answers collected so far.',
        inputSchema: { projectId: z.string() },
        annotations: { readOnlyHint: true },
    }, async ({ projectId }) => {
        try {
            const p = getProject(projectId);
            const prog = progress(p);
            const md = capacityMarkdown(estimateCapacity(answerMap(p)));
            return ok(`${prog.pending ? `⚠️ ${prog.pending} question(s) are still unanswered, so some numbers use defaults.\n\n` : ''}${md}`);
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_generate_design', {
        title: 'Generate HLD / LLD',
        description: 'Generate the design sections. Depending on configuration and IDE support, either the server writes them using the configured model (Claude API / Ollama / the IDE\'s model via sampling), or — in host-authoring mode — it returns section briefs for YOU to write, which you then submit with archforge_submit_sections. Each call handles a few sections; keep calling with the same arguments until it says everything is complete. Use sectionIds + feedback to revise specific sections.',
        inputSchema: {
            projectId: z.string(),
            scope: z.enum(['hld', 'lld', 'all']).optional().describe('Default "all".'),
            sectionIds: z.array(z.string()).optional().describe('Regenerate exactly these sections (e.g. ["hld.cloud"]).'),
            feedback: z.string().optional().describe('User feedback to apply when regenerating sectionIds.'),
            regenerate: z.enum(['missing', 'stale', 'all']).optional().describe('"missing" (default): only unwritten sections; "stale": also those written before the requirements changed; "all": rewrite everything in scope.'),
            force: z.boolean().optional().describe('Proceed even though interview questions are unanswered (defaults are used and listed as assumptions).'),
        },
    }, async (args, extra) => {
        try {
            const p = getProject(args.projectId);
            const cfg = loadConfig();
            const pend = pendingQuestions(p);
            if (pend.length) {
                if (!args.force) {
                    return ok(`The interview is not finished: ${pend.length} question(s) still need answers (next: ${pend.slice(0, 4).map((q) => q.id).join(', ')}…).\n` +
                        'Call archforge_ask to finish it. If the user prefers to proceed on defaults, call this tool again with force:true — the assumptions will be listed in the documents.');
                }
                applyDefaults(p, 'all');
            }
            // Which sections?
            let targets;
            let regenerateMode = args.regenerate ?? 'missing';
            if (args.sectionIds?.length) {
                const unknown = args.sectionIds.filter((id) => !SECTION_BY_ID[id]);
                if (unknown.length)
                    return fail(`Unknown section id(s): ${unknown.join(', ')}. Valid: ${SECTIONS.map((s) => s.id).join(', ')}`);
                targets = SECTIONS.filter((s) => args.sectionIds.includes(s.id) && s.kind === 'llm');
            }
            else {
                const pool = sectionsFor(args.scope ?? 'all').filter((s) => s.kind === 'llm');
                if (regenerateMode === 'all') {
                    for (const d of pool)
                        if (p.sections[d.id])
                            p.sections[d.id].answersVersion = -1;
                    regenerateMode = 'stale';
                }
                targets = pool.filter((d) => {
                    const s = p.sections[d.id];
                    return !s || (regenerateMode === 'stale' && s.answersVersion < p.answersVersion);
                });
            }
            const cap = refreshComputed(p);
            store.save(p);
            if (!targets.length) {
                return ok(`Nothing left to generate for this scope. ${nextStep(p)}`);
            }
            const resolved = resolveLlm(cfg, server);
            const batchSize = resolved.kind === 'host' ? Math.min(3, cfg.generation.sectionsPerCall) : cfg.generation.sectionsPerCall;
            const batch = targets.slice(0, batchSize);
            const remaining = targets.slice(batchSize);
            const callAgain = args.sectionIds?.length
                ? `archforge_generate_design {"projectId":"${p.id}","sectionIds":${JSON.stringify(remaining.map((r) => r.id))}${args.feedback ? `,"feedback":${JSON.stringify(args.feedback)}` : ''}}`
                : `archforge_generate_design {"projectId":"${p.id}"${args.scope ? `,"scope":"${args.scope}"` : ''}${regenerateMode === 'stale' ? ',"regenerate":"stale"' : ''}}`;
            // ── host authoring: hand briefs to the IDE's chat model
            if (resolved.kind === 'host') {
                const L = [
                    '# ARCHFORGE — HOST AUTHORING',
                    resolved.note ? `ℹ️ ${resolved.note}` : '',
                    `You (the assistant) must now write ${batch.length} section(s) of the design for "${p.name}". ${remaining.length} more will follow after these.`,
                    '',
                    '## Writing rules',
                    SYSTEM_PROMPT,
                    '',
                    '## Shared project context',
                    contextPack(p, cap),
                    '',
                    '## Sections to write now',
                    ...batch.flatMap((d) => [sectionBrief(d, p, { feedback: args.feedback }), '']),
                    '---',
                    `When written, call archforge_submit_sections {"projectId":"${p.id}","sections":[{"sectionId":"…","content":"…markdown…"}, …]} with ALL ${batch.length} section(s) in one call.`,
                    'If validation reports problems, fix just those sections and resubmit them. Then continue with archforge_generate_design until it reports completion. Do not summarise or skip sections; do not tell the user the document is done until export succeeds.',
                ];
                return ok(L.filter((x) => x !== undefined).join('\n'));
            }
            // ── server-side generation (provider or sampling)
            const provider = resolved.provider;
            const done = [];
            const warn = [];
            for (let i = 0; i < batch.length; i++) {
                const def = batch[i];
                notify(extra, i, batch.length, `Writing ${def.title}…`);
                try {
                    const r = await generateOne(def, p, cap, provider, cfg, args.feedback);
                    p.sections[def.id] = {
                        content: r.content,
                        generatedBy: provider.id,
                        answersVersion: p.answersVersion,
                        updatedAt: new Date().toISOString(),
                        ...(r.issues.length ? { warnings: r.issues } : {}),
                    };
                    store.save(p);
                    done.push(`- ✔ [${def.id}] ${def.title}${r.attempts > 1 ? ` (${r.attempts} attempts)` : ''}`);
                    if (r.issues.length)
                        warn.push(`- ⚠ [${def.id}] kept with ${r.issues.length} validation issue(s): ${r.issues.slice(0, 3).join(' | ')}`);
                }
                catch (e) {
                    const hint = resolved.kind === 'sampling'
                        ? 'The IDE rejected or failed the sampling request (the user may have declined it).'
                        : 'Check the provider settings with archforge_config {test:true}.';
                    return fail([
                        `Generation stopped at [${def.id}] ${def.title}: ${errMsg(e)}`,
                        hint,
                        done.length ? `Completed before the failure:\n${done.join('\n')}` : '',
                        'Options: fix the provider, or switch to host authoring with archforge_config {llmMode:"host"} so the IDE chat model writes the sections.',
                    ]
                        .filter(Boolean)
                        .join('\n'));
                }
            }
            notify(extra, batch.length, batch.length, 'Batch complete');
            const L = [`Wrote ${done.length} section(s) with ${provider.label}:`, ...done];
            if (resolved.note)
                L.unshift(`ℹ️ ${resolved.note}`);
            if (warn.length)
                L.push('', ...warn, 'Re-run those with archforge_generate_design {sectionIds:[…], feedback:"fix diagram syntax"} if they matter.');
            L.push('');
            L.push(remaining.length ? `${remaining.length} section(s) remain. Call again: ${callAgain}` : `All requested sections are written. ${nextStep(p)}`);
            return ok(L.join('\n'));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_submit_sections', {
        title: 'Submit written sections (host authoring)',
        description: 'Submit design sections you wrote from archforge_generate_design briefs. The server cleans headings, validates Mermaid diagrams and required content, stores accepted sections and returns problems for the rest.',
        inputSchema: {
            projectId: z.string(),
            sections: z.array(z.object({ sectionId: z.string(), content: z.string().describe('Markdown body of the section (no top-level title).') })).min(1),
            force: z.boolean().optional().describe('Store sections even if validation reports problems (use only if a reported issue is a false positive).'),
        },
    }, async ({ projectId, sections, force }) => {
        try {
            const p = getProject(projectId);
            const accepted = [];
            const rejected = [];
            for (const s of sections) {
                const def = SECTION_BY_ID[s.sectionId];
                if (!def || def.kind !== 'llm') {
                    rejected.push(`✘ [${s.sectionId}] unknown or computed section.`);
                    continue;
                }
                const lint = lintSection(def, s.content);
                if (lint.issues.length && !force) {
                    rejected.push(`✘ [${s.sectionId}] not stored — fix and resubmit:\n${lint.issues.map((i) => `   - ${i}`).join('\n')}`);
                    continue;
                }
                p.sections[def.id] = {
                    content: lint.content,
                    generatedBy: 'host',
                    answersVersion: p.answersVersion,
                    updatedAt: new Date().toISOString(),
                    ...(lint.issues.length ? { warnings: lint.issues } : {}),
                };
                accepted.push(`✔ [${def.id}] ${def.title}${lint.issues.length ? ' (stored with warnings)' : ''}`);
            }
            store.save(p);
            const L = [...accepted, ...rejected, ''];
            const missing = SECTIONS.filter((d) => d.kind === 'llm' && !p.sections[d.id]).length;
            L.push(rejected.length ? 'Resubmit the rejected sections first.' : missing ? `${missing} section(s) still unwritten — call archforge_generate_design again.` : nextStep(p));
            return ok(L.join('\n'));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_status', {
        title: 'Project status',
        description: 'Without projectId: list all projects. With projectId: interview progress, which sections are written / stale / missing, how documents will be written, and the next step.',
        inputSchema: { projectId: z.string().optional() },
        annotations: { readOnlyHint: true },
    }, async ({ projectId }) => {
        try {
            if (!projectId) {
                const all = store.list();
                if (!all.length)
                    return ok('No projects yet. Start one with archforge_start_project.');
                return ok(all
                    .map((p) => {
                    const done = SECTIONS.filter((d) => p.sections[d.id]).length;
                    return `- ${p.id} — "${p.name}" — interview ${progress(p).answered}/${progress(p).total}, sections ${done}/${SECTIONS.length} — updated ${p.updatedAt.slice(0, 16).replace('T', ' ')}`;
                })
                    .join('\n'));
            }
            const p = getProject(projectId);
            const prog = progress(p);
            const resolved = resolveLlm(loadConfig(), server);
            const how = resolved.kind === 'host' ? "the IDE's chat model (host authoring)" : resolved.provider.label;
            const rows = SECTIONS.map((d) => {
                const s = p.sections[d.id];
                const st = !s ? '✗ missing' : s.answersVersion < p.answersVersion ? '⟳ stale' : s.warnings?.length ? '⚠ warnings' : '✔ done';
                return `| ${d.id} | ${d.title} | ${st} | ${s?.generatedBy ?? ''} |`;
            });
            return ok([
                `# ${p.name} (${p.id})`,
                `Interview: ${prog.answered}/${prog.total} answered, ${prog.pending} pending.`,
                `Documents will be written by: ${how}${resolved.note ? ` — ${resolved.note}` : ''}`,
                '',
                '| id | section | status | by |',
                '|---|---|---|---|',
                ...rows,
                '',
                nextStep(p),
            ].join('\n'));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_export', {
        title: 'Export documents',
        description: 'Write hld.md, lld.md, README.md (index + assumptions), requirements.json, a viewer.html and every Mermaid diagram as .mmd into the workspace (default docs/architecture). Partial exports are allowed; missing sections are marked.',
        inputSchema: {
            projectId: z.string(),
            outDir: z.string().optional().describe('Output directory (relative to the workspace root, or absolute). Default: docs/architecture.'),
        },
    }, async ({ projectId, outDir }) => {
        try {
            const p = getProject(projectId);
            const cfg = loadConfig();
            let base = (await workspaceRoot()) ?? process.cwd();
            let fallbackNote = '';
            if (path.resolve(base) === path.parse(base).root || path.resolve(base) === os.homedir()) {
                if (!outDir || !path.isAbsolute(outDir)) {
                    base = path.join(homeDir(), 'exports', p.id);
                    fallbackNote = `\nℹ️ The IDE did not expose a workspace folder, so files were written under ${base}. Pass outDir (absolute path) to choose another location.`;
                }
            }
            const dir = path.resolve(base, outDir ?? cfg.output.dir);
            const r = writeExport(p, dir);
            const L = [`Exported ${r.files.length} file(s) to ${dir}:`, ...r.files.map((f) => `- ${path.relative(dir, f)}`)];
            if (r.missing.length)
                L.push('', `⚠️ Not generated yet (marked in the docs): ${r.missing.join(', ')}`);
            if (r.stale.length)
                L.push('', `⚠️ Stale (requirements changed after writing): ${r.stale.join(', ')}`);
            L.push('', 'Tell the user the folder path and that hld.md / lld.md contain Mermaid diagrams (preview in the IDE\'s Markdown preview or open viewer.html).' + fallbackNote);
            return ok(L.join('\n'));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    server.registerTool('archforge_config', {
        title: 'Configure / diagnose',
        description: 'Show diagnostics (what this IDE supports, which model will write the documents, how questions are shown) or change settings. API keys are never accepted here: set the environment variable named by apiKeyEnv in the IDE\'s MCP server config. With test:true a tiny request is sent to the resolved model.',
        inputSchema: {
            llmMode: z.enum(['auto', 'provider', 'sampling', 'host']).optional().describe('auto = configured provider → IDE sampling → IDE chat model.'),
            provider: z.enum(['anthropic', 'ollama', 'openai-compatible', 'none']).optional(),
            model: z.string().optional(),
            baseUrl: z.string().optional(),
            apiKeyEnv: z.string().optional().describe('NAME of the environment variable that holds the API key.'),
            questionMode: z.enum(['auto', 'elicit', 'chat']).optional(),
            sectionsPerCall: z.number().int().min(1).max(10).optional(),
            outputDir: z.string().optional(),
            test: z.boolean().optional().describe('Send a tiny test request to the resolved model.'),
        },
    }, async (a) => {
        try {
            const changed = [];
            if (a.llmMode || a.provider || a.model !== undefined || a.baseUrl !== undefined || a.apiKeyEnv !== undefined || a.questionMode || a.sectionsPerCall || a.outputDir) {
                const f = loadFileConfig();
                if (a.llmMode)
                    (f.llm.mode = a.llmMode), changed.push(`llm.mode=${a.llmMode}`);
                if (a.provider) {
                    f.llm.provider = a.provider === 'none' ? undefined : a.provider;
                    changed.push(`llm.provider=${a.provider}`);
                }
                if (a.model !== undefined)
                    (f.llm.model = a.model || undefined), changed.push(`llm.model=${a.model}`);
                if (a.baseUrl !== undefined)
                    (f.llm.baseUrl = a.baseUrl || undefined), changed.push(`llm.baseUrl=${a.baseUrl}`);
                if (a.apiKeyEnv !== undefined)
                    (f.llm.apiKeyEnv = a.apiKeyEnv || undefined), changed.push(`llm.apiKeyEnv=${a.apiKeyEnv}`);
                if (a.questionMode)
                    (f.ui.questionMode = a.questionMode), changed.push(`ui.questionMode=${a.questionMode}`);
                if (a.sectionsPerCall)
                    (f.generation.sectionsPerCall = a.sectionsPerCall), changed.push(`generation.sectionsPerCall=${a.sectionsPerCall}`);
                if (a.outputDir)
                    (f.output.dir = a.outputDir), changed.push(`output.dir=${a.outputDir}`);
                saveConfig(f);
            }
            const cfg = loadConfig();
            const caps = server.server.getClientCapabilities();
            const ver = server.server.getClientVersion();
            const resolved = resolveLlm(cfg, server);
            const built = buildProvider(cfg);
            const L = [];
            if (changed.length)
                L.push(`Saved: ${changed.join(', ')}`, '');
            L.push('## Environment');
            L.push(`- IDE/client: ${ver ? `${ver.name} ${ver.version}` : 'unknown'}`);
            L.push(`- Popup forms (elicitation): ${clientSupportsElicitation(server) ? 'supported' : 'not supported → chat questions'}`);
            L.push(`- IDE model access (sampling): ${clientSupportsSampling(server) ? 'supported' : 'not supported'}`);
            L.push(`- Workspace roots: ${caps?.roots ? 'supported' : 'not supported'}`);
            L.push('', '## Settings');
            L.push(`- llm.mode: ${cfg.llm.mode}`);
            L.push(`- llm.provider: ${cfg.llm.provider ?? '(none)'}${cfg.llm.model ? ` · model ${cfg.llm.model}` : ''}${cfg.llm.baseUrl ? ` · ${cfg.llm.baseUrl}` : ''}`);
            if (cfg.llm.provider) {
                const envName = cfg.llm.apiKeyEnv ?? defaultApiKeyEnv(cfg.llm.provider);
                if (envName)
                    L.push(`- API key variable ${envName}: ${process.env[envName] ? 'set' : 'NOT set'}`);
                if (cfg.llm.provider === 'ollama') {
                    const url = (cfg.llm.baseUrl ?? defaultBaseUrl('ollama')).replace(/\/+$/, '');
                    try {
                        const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2500) });
                        const j = await r.json();
                        const names = (j.models ?? []).map((m) => m.name);
                        L.push(`- Ollama reachable at ${url}; models: ${names.slice(0, 12).join(', ') || '(none pulled)'}`);
                        if (cfg.llm.model && names.length && !names.some((n) => n === cfg.llm.model || n.startsWith(cfg.llm.model + ':'))) {
                            L.push(`  ⚠ model "${cfg.llm.model}" is not pulled — run: ollama pull ${cfg.llm.model}`);
                        }
                    }
                    catch {
                        L.push(`- Ollama NOT reachable at ${url} — is it running?`);
                    }
                }
                if (built.problem)
                    L.push(`- Provider problem: ${built.problem}`);
            }
            L.push(`- ui.questionMode: ${cfg.ui.questionMode}`);
            L.push(`- generation.sectionsPerCall: ${cfg.generation.sectionsPerCall}`);
            L.push(`- output.dir: ${cfg.output.dir}`);
            L.push(`- config file: ${configPath()}`);
            L.push('', '## Resolution');
            L.push(`- Documents will be written by: ${resolved.kind === 'host' ? "the IDE's chat model (host authoring)" : resolved.provider.label}${resolved.note ? ` — ${resolved.note}` : ''}`);
            L.push(`- Questions will be shown as: ${cfg.ui.questionMode !== 'chat' && clientSupportsElicitation(server) ? 'popup forms' : 'chat questions'}`);
            if (a.test) {
                L.push('', '## Test');
                if (resolved.kind === 'host')
                    L.push('Host authoring uses the IDE chat model; nothing to test server-side.');
                else {
                    const t0 = Date.now();
                    try {
                        const out = await resolved.provider.complete({ system: 'You are a test endpoint.', prompt: 'Reply with the single word OK.', maxTokens: 20 });
                        L.push(`✔ ${resolved.provider.label} replied in ${Date.now() - t0} ms: "${out.trim().slice(0, 60)}"`);
                    }
                    catch (e) {
                        L.push(`✘ ${resolved.provider.label} failed: ${errMsg(e)}`);
                    }
                }
            }
            return ok(L.join('\n'));
        }
        catch (e) {
            return fail(errMsg(e));
        }
    });
    // ───────────────────────── prompt (slash command) ─────────────────────────
    server.registerPrompt('design_app', {
        title: 'Design an application (HLD + LLD)',
        description: 'Interview me about an app idea and produce a complete HLD and LLD with diagrams.',
        argsSchema: { idea: z.string().describe('What do you want to build?') },
    }, ({ idea }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Use the Archforge tools to design this application end to end, producing a High-Level Design and a Low-Level Design I can build from.\n\nMy idea: ${idea}\n\n` +
                        'Steps: archforge_start_project → (pre-fill only what my idea clearly states, as "inferred") → archforge_ask and let me answer the questions (do not answer for me) → archforge_generate_design until complete (write sections yourself and submit them if it asks you to) → archforge_export. Then tell me where the files are and summarise the key decisions and assumptions.',
                },
            },
        ],
    }));
    return server;
}
export async function runServer() {
    // When the IDE closes the pipe, exit quietly instead of crashing with EPIPE.
    process.stdout.on('error', () => process.exit(0));
    process.stdin.on('close', () => process.exit(0));
    const server = createServer();
    await server.connect(new StdioServerTransport());
    console.error(`[archforge] v${VERSION} ready (data: ${homeDir()})`);
}
