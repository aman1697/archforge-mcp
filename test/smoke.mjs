import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CreateMessageRequestSchema, ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'dist', 'index.js');
const results = [];
const step = (name) => console.log(`\n▶ ${name}`);
const pass = (msg) => { results.push(msg); console.log(`  ✔ ${msg}`); };

// ───────────── fake LLM content ─────────────
const DIAGRAMS = {
  flowchart: 'flowchart LR\n  U[User] --> API["API Gateway (Kong)"]\n  API --> DB[(Postgres)]',
  sequenceDiagram: 'sequenceDiagram\n  participant U as User\n  participant A as API\n  U->>A: request\n  alt ok\n    A-->>U: 200\n  else fail\n    A-->>U: 500\n  end',
  erDiagram: 'erDiagram\n  USER ||--o{ ORDER : "places"\n  USER {\n    uuid id PK\n    varchar email\n  }',
  classDiagram: 'classDiagram\n  class Order {\n    +id string\n    +total() number\n  }',
  'stateDiagram-v2': 'stateDiagram-v2\n  [*] --> Created\n  Created --> Paid\n  Paid --> [*]',
};
function fakeSection(text, { breakFirst = false } = {}) {
  const m = text.match(/REQUIRED_DIAGRAMS: (.*?) — /);
  let out = 'This is a detailed, application-specific section body. '.repeat(14) + '\n\n### Details\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n';
  if (m) {
    for (const part of m[1].split(',')) {
      const [type, times] = part.trim().split(' ×');
      const n = Number(times ?? 1);
      for (let i = 0; i < n; i++) out += '```mermaid\n' + DIAGRAMS[type] + '\n```\n\n';
    }
  }
  if (breakFirst) out = out.replace('API["API Gateway (Kong)"]', 'API[API Gateway (Kong)]');
  return out;
}

// ───────────── client harness ─────────────
async function connect({ elicit = false, sampling = false, env = {}, answers = {} } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'archforge-home-'));
  const client = new Client(
    { name: 'smoke-test-ide', version: '1.0.0' },
    { capabilities: { ...(elicit ? { elicitation: { form: {} } } : {}), ...(sampling ? { sampling: {} } : {}) } },
  );
  const seen = { elicitations: [], samplings: 0 };
  if (elicit) {
    client.setRequestHandler(ElicitRequestSchema, async (req) => {
      const props = req.params.requestedSchema.properties;
      seen.elicitations.push({ message: req.params.message, keys: Object.keys(props) });
      const content = {};
      const required = req.params.requestedSchema.required ?? [];
      for (const [k, v] of Object.entries(props)) {
        if (k in answers) content[k] = answers[k];
        else if (v.default !== undefined) content[k] = v.default;
        else if (!required.includes(k)) continue; // blank optional field: client omits it
        else if (v.type === 'string') content[k] = v.enum ? v.enum[0] : 'n/a';
        else if (v.type === 'number') content[k] = v.minimum ?? 1;
        else if (v.type === 'boolean') content[k] = false;
      }
      return { action: 'accept', content };
    });
  }
  if (sampling) {
    client.setRequestHandler(CreateMessageRequestSchema, async (req) => {
      seen.samplings++;
      const text = req.params.messages[0].content.text;
      return { role: 'assistant', model: 'fake-ide-model', content: { type: 'text', text: fakeSection(text) } };
    });
  }
  const transport = new StdioClientTransport({
    command: 'node',
    args: [entry],
    env: { ...process.env, ARCHFORGE_HOME: home, ...env },
  });
  await client.connect(transport);
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return { text: r.content.map((c) => c.text).join('\n'), isError: !!r.isError };
  };
  return { client, call, seen, home, close: () => client.close() };
}
const projectId = (text) => text.match(/id: ([a-z0-9-]+)\)/)[1];

// ───────────── unit checks ─────────────
step('Lint & normalisation');
{
  const { lintMermaid, normalizeHeadings, detectType } = await import(path.join(root, 'dist/design/diagrams.js'));
  assert.deepEqual(lintMermaid(DIAGRAMS.flowchart, 'flowchart'), []);
  assert.deepEqual(lintMermaid(DIAGRAMS.sequenceDiagram, 'sequenceDiagram'), []);
  assert.deepEqual(lintMermaid(DIAGRAMS.erDiagram, 'erDiagram'), []);
  assert.deepEqual(lintMermaid(DIAGRAMS['stateDiagram-v2'], 'stateDiagram-v2'), []);
  assert.ok(lintMermaid('flowchart LR\n A[Label (x)] --> B', 'flowchart').length, 'unquoted parens flagged');
  assert.ok(lintMermaid('sequenceDiagram\n A->>B: hi\n alt x\n B-->>A: y', 'sequenceDiagram').length, 'missing end flagged');
  assert.ok(lintMermaid('erDiagram\n U {\n varchar(255) name\n }', 'erDiagram').length, 'varchar(255) flagged');
  assert.ok(lintMermaid('erDiagram\n A ||--o{ B', 'erDiagram').length, 'relationship w/o label flagged');
  assert.equal(detectType('graph TD\n A-->B'), 'flowchart');
  assert.equal(normalizeHeadings('# T\n## S\ntext\n```\n# not heading\n```'), '### T\n#### S\ntext\n```\n# not heading\n```');
  pass('mermaid lint catches common LLM mistakes and accepts valid diagrams');
  pass('heading normalisation shifts to H3 and ignores code fences');
}

// ───────────── A: popup forms + IDE sampling ─────────────
step('A) IDE with popup forms + sampling (best experience)');
{
  const h = await connect({
    elicit: true,
    sampling: true,
    answers: { 'capabilities__payments': true, 'capabilities__realtime': true, 'capabilities__file_uploads': true, user_base: 'b2b', concurrent_users: 2000, cloud: 'aws' },
  });
  const tools = (await h.client.listTools()).tools.map((t) => t.name);
  assert.ok(tools.includes('archforge_generate_design') && tools.length === 9, `tools: ${tools.length}`);
  const prompts = (await h.client.listPrompts()).prompts.map((p) => p.name);
  assert.ok(prompts.includes('design_app'));
  pass(`9 tools + prompt registered`);

  const start = await h.call('archforge_start_project', { name: 'FoodDash', description: 'Food delivery app with live courier tracking and card payments for restaurants.' });
  const id = projectId(start.text);
  assert.ok(start.text.includes('QUESTION CATALOG'));
  const inf = await h.call('archforge_submit_answers', { projectId: id, source: 'inferred', answers: [{ id: 'app_type', value: 'web_mobile' }, { id: 'bogus', value: 1 }] });
  assert.ok(inf.text.includes('Could not record') && inf.text.includes('Unknown question id'));
  pass('inferred answers recorded, unknown ids rejected');

  const ask = await h.call('archforge_ask', { projectId: id });
  assert.ok(ask.text.includes('Interview complete'), ask.text.slice(0, 300));
  const rounds = h.seen.elicitations.length;
  assert.ok(rounds >= 6, `expected several forms, got ${rounds}`);
  const allKeys = h.seen.elicitations.flatMap((e) => e.keys);
  for (const k of ['payment_scope', 'multi_tenant', 'realtime_connections', 'upload_mb_per_user']) assert.ok(allKeys.includes(k), `follow-up ${k} should have been asked`);
  assert.ok(h.seen.elicitations.some((e) => e.message.includes('follow-up')), 'follow-up label shown');
  pass(`${rounds} popup forms; follow-ups appeared from earlier answers (payments → card handling, B2B → tenancy, realtime → connections, uploads → storage)`);
  const prefilled = h.seen.elicitations.flatMap((e) => e.keys).includes('app_type');
  assert.ok(prefilled);

  const cap = await h.call('archforge_capacity', { projectId: id });
  assert.ok(cap.text.includes('520'), 'design RPS 2000*6/60*2*1.3 = 520');
  pass('capacity maths: 2,000 concurrent × 6 req/min ⇒ 200 RPS, ×2 growth ×1.3 headroom ⇒ 520 design RPS');

  let finished = false;
  for (let i = 0; i < 12 && !finished; i++) {
    const g = await h.call('archforge_generate_design', { projectId: id });
    assert.ok(!g.isError, g.text);
    finished = g.text.includes('All requested sections are written');
  }
  assert.ok(finished, 'generation loop completes');
  assert.ok(h.seen.samplings >= 21, `sampling calls: ${h.seen.samplings}`);
  pass(`all sections generated through the IDE's model via sampling (${h.seen.samplings} sampling requests)`);

  const out = path.join(os.tmpdir(), 'archforge-out-A');
  fs.rmSync(out, { recursive: true, force: true });
  const ex = await h.call('archforge_export', { projectId: id, outDir: out });
  assert.ok(!ex.isError, ex.text);
  for (const f of ['hld.md', 'lld.md', 'README.md', 'viewer.html', 'requirements.json']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const hld = fs.readFileSync(path.join(out, 'hld.md'), 'utf8');
  assert.ok(hld.includes('## 3. Capacity Estimation') && hld.includes('```mermaid'));
  assert.ok(fs.readdirSync(path.join(out, 'diagrams')).length === 14, 'exactly the 14 required diagrams');
  const readme = fs.readFileSync(path.join(out, 'README.md'), 'utf8');
  assert.ok(readme.includes('Assumptions to confirm'));
  pass('exported hld.md, lld.md, README.md, viewer.html, requirements.json and .mmd diagrams');

  // staleness
  await h.call('archforge_submit_answers', { projectId: id, answers: [{ id: 'concurrent_users', value: '5k' }], useDefaultsFor: [] });
  const st = await h.call('archforge_status', { projectId: id });
  assert.ok(st.text.includes('⟳ stale'));
  pass('changing an answer marks written sections stale');

  const cfg = await h.call('archforge_config', {});
  assert.ok(cfg.text.includes('popup forms') && cfg.text.includes('IDE model access (sampling): supported'));
  pass('config diagnostics report client capabilities');
  await h.close();
}

// ───────────── B: bare client → chat questions + host authoring ─────────────
step('B) IDE with NO popups and NO sampling (fallback: chat + host authoring)');
{
  const h = await connect({});
  const start = await h.call('archforge_start_project', { name: 'Notes API', description: 'Simple notes backend with sync across devices.' });
  const id = projectId(start.text);
  const ask = await h.call('archforge_ask', { projectId: id });
  assert.ok(ask.text.includes('INSTRUCTIONS FOR THE ASSISTANT') && ask.text.includes('`app_type`') && ask.text.includes('step 1 of 4'));
  pass('questions returned as a structured chat questionnaire with instructions for the host model');

  const bad = await h.call('archforge_submit_answers', {
    projectId: id,
    answers: [{ id: 'app_type', value: 'Mobile app (iOS/Android)' }, { id: 'user_base', value: 'B2B' }, { id: 'capabilities', value: ['search', 'teleport'] }],
  });
  assert.ok(bad.text.includes('Could not record') && bad.text.includes('teleport'));
  assert.ok(bad.text.includes('`capabilities`'), 'invalid question asked again');
  pass('labels/case-insensitive values accepted; invalid values rejected and re-asked');

  const fix = await h.call('archforge_submit_answers', { projectId: id, answers: [{ id: 'capabilities', value: ['search'] }, { id: 'core_features', value: 'create notes, sync' }] });
  assert.ok(fix.text.includes('`multi_tenant`'), 'B2B follow-up appears in chat mode');
  pass('B2B answer triggers a tenancy follow-up in chat mode');

  const all = await h.call('archforge_submit_answers', { projectId: id, acceptAllDefaults: true });
  assert.ok(all.text.includes('Interview complete') && all.text.includes('assumed default'));
  pass('"use defaults" completes the interview and records assumptions');

  const gen = await h.call('archforge_generate_design', { projectId: id });
  assert.ok(gen.text.includes('HOST AUTHORING') && gen.text.includes('[hld.overview]'));
  pass('no model available server-side → host-authoring briefs returned');

  const rejected = await h.call('archforge_submit_sections', { projectId: id, sections: [{ sectionId: 'hld.overview', content: 'too short' }] });
  assert.ok(rejected.text.includes('✘') && rejected.text.includes('too short'));
  pass('short/invalid host submission is rejected with actionable issues');

  let text = gen.text;
  let done = false;
  for (let i = 0; i < 15 && !done; i++) {
    const parts = text.split(/^### \[([a-z_.]+)\] /m);
    const sections = [];
    for (let k = 1; k < parts.length; k += 2) sections.push({ sectionId: parts[k], content: fakeSection(parts[k + 1]) });
    assert.ok(sections.length > 0, 'brief had sections');
    const sub = await h.call('archforge_submit_sections', { projectId: id, sections });
    assert.ok(!sub.text.includes('✘'), sub.text);
    const next = await h.call('archforge_generate_design', { projectId: id });
    if (next.text.includes('Nothing left')) done = true;
    else text = next.text;
  }
  assert.ok(done);
  const ex = await h.call('archforge_export', { projectId: id, outDir: path.join(os.tmpdir(), 'archforge-out-B') });
  assert.ok(!ex.isError && !ex.text.includes('Not generated yet'), ex.text);
  pass('host-authored sections validated, stored and exported');
  await h.close();
}

// ───────────── C: provider mode (mock Ollama + mock Claude API) ─────────────
step('C) Own provider: Ollama and Claude API (mock servers) incl. self-repair of bad diagrams');
{
  let ollamaCalls = 0, anthropicCalls = 0, sawKey = '', ctx = 0, brokeOnce = false;
  const srv = http.createServer((req, res) => {
    if (req.method === 'GET') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ models: [{ name: 'test-model' }] }));
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body);
      const prompt = req.url === '/api/chat' ? j.messages[1].content : j.messages[0].content;
      const isArch = prompt.includes('Write the section "Architecture Overview & Style"');
      const retry = prompt.includes('previous attempt was rejected');
      const breakIt = isArch && !retry && !brokeOnce;
      if (breakIt) brokeOnce = true;
      const text = fakeSection(prompt, { breakFirst: breakIt });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/api/chat') { ollamaCalls++; ctx = j.options.num_ctx; res.end(JSON.stringify({ message: { role: 'assistant', content: text } })); }
      else if (req.url === '/v1/messages') { anthropicCalls++; sawKey = req.headers['x-api-key']; res.end(JSON.stringify({ content: [{ type: 'text', text }] })); }
      else { res.statusCode = 404; res.end('{}'); }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;

  const h = await connect({ env: { ARCHFORGE_LLM_PROVIDER: 'ollama', ARCHFORGE_LLM_MODEL: 'test-model', ARCHFORGE_LLM_BASE_URL: base } });
  const id = projectId((await h.call('archforge_start_project', { name: 'Provider Test', description: 'Testing provider mode end to end.' })).text);
  await h.call('archforge_submit_answers', { projectId: id, acceptAllDefaults: true });
  const g1 = await h.call('archforge_generate_design', { projectId: id, scope: 'hld' });
  assert.ok(g1.text.includes('Ollama (test-model)'), g1.text);
  assert.ok(ollamaCalls >= 4 && ctx === 16384);
  assert.ok(g1.text.includes('[hld.architecture]') && g1.text.includes('2 attempts'), g1.text);
  pass(`Ollama provider used (num_ctx=${ctx}); bad diagram auto-repaired on retry`);
  const t = await h.call('archforge_config', { test: true });
  assert.ok(t.text.includes('✔ Ollama'), t.text);
  pass('archforge_config test:true verifies the provider');
  const sw = await h.call('archforge_config', { llmMode: 'host' });
  assert.ok(sw.text.includes("IDE's chat model (host authoring)"));
  const g2 = await h.call('archforge_generate_design', { projectId: id, scope: 'hld' });
  assert.ok(g2.text.includes('HOST AUTHORING'));
  pass('switching llmMode to host at runtime changes who writes the docs');
  await h.close();

  const h2 = await connect({ env: { ARCHFORGE_LLM_PROVIDER: 'anthropic', ARCHFORGE_LLM_BASE_URL: base, ANTHROPIC_API_KEY: 'sk-test-123' } });
  const id2 = projectId((await h2.call('archforge_start_project', { name: 'Claude Test', description: 'Testing the Claude API provider.' })).text);
  await h2.call('archforge_submit_answers', { projectId: id2, acceptAllDefaults: true });
  const g3 = await h2.call('archforge_generate_design', { projectId: id2, scope: 'lld' });
  assert.ok(g3.text.includes('Claude API (claude-sonnet-5-5)'), g3.text);
  assert.equal(sawKey, 'sk-test-123');
  assert.ok(anthropicCalls >= 4);
  pass('Claude API provider used with key taken from the environment (never stored)');

  const h3 = await connect({ env: { ARCHFORGE_LLM_PROVIDER: 'anthropic', ARCHFORGE_LLM_BASE_URL: base, ANTHROPIC_API_KEY: '' } });
  const c3 = await h3.call('archforge_config', {});
  assert.ok(c3.text.includes('NOT set') && c3.text.includes('chat model'));
  pass('missing API key degrades gracefully to the IDE chat model with a clear explanation');
  await h3.close(); await h2.close();
  srv.close();
}

console.log(`\nALL GOOD — ${results.length} checks passed`);
process.exit(0);
