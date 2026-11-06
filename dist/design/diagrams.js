const KNOWN_TYPES = 'flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|architecture-beta|block-beta|quadrantChart|requirementDiagram|sankey-beta|xychart-beta';
const TYPE_RE = new RegExp(`^(${KNOWN_TYPES})\\b`);
function normalizeType(t) {
    if (t === 'graph')
        return 'flowchart';
    if (t === 'stateDiagram')
        return 'stateDiagram-v2';
    return t;
}
export function detectType(code) {
    for (const raw of code.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('%%'))
            continue;
        const m = line.match(TYPE_RE);
        return m ? normalizeType(m[1]) : 'unknown';
    }
    return 'empty';
}
export function extractDiagrams(md) {
    const out = [];
    const re = /```mermaid[^\S\r\n]*\r?\n([\s\S]*?)\r?\n[^\S\r\n]*```/g;
    let m;
    while ((m = re.exec(md))) {
        const code = m[1].trim();
        out.push({ type: detectType(code), code });
    }
    return out;
}
/** Heuristic lint — catches the mistakes LLMs make most often. It is not a full Mermaid parser. */
export function lintMermaid(code, type) {
    const issues = [];
    if (type === 'empty')
        return ['Diagram is empty.'];
    if (type === 'unknown')
        return ['Diagram does not start with a recognised Mermaid type (e.g. "flowchart LR", "sequenceDiagram", "erDiagram").'];
    if (/[\u201C\u201D\u2018\u2019]/.test(code))
        issues.push('Contains smart quotes (“ ” ‘ ’); use plain ASCII quotes.');
    if (/```/.test(code))
        issues.push('Contains a nested code fence.');
    const stripped = code.replace(/"[^"\n]*"/g, '""');
    const lines = stripped.split(/\r?\n/);
    if (type === 'flowchart') {
        lines.forEach((line, i) => {
            const t = line.trim();
            if (!t || t.startsWith('%%'))
                return;
            const count = (c) => (t.match(new RegExp('\\' + c, 'g')) ?? []).length;
            const asym = /\w>[^\]]*\]/.test(t); // asymmetric shape  id>text]
            if (!asym && count('[') !== count(']'))
                issues.push(`Line ${i + 1}: unbalanced [ ] — "${t.slice(0, 70)}"`);
            if (count('(') !== count(')'))
                issues.push(`Line ${i + 1}: unbalanced ( ) — "${t.slice(0, 70)}"`);
            if (count('{') !== count('}'))
                issues.push(`Line ${i + 1}: unbalanced { } — "${t.slice(0, 70)}"`);
            // unquoted rectangle label containing parentheses, e.g. A[Label (x)]  (cylinder A[(DB)] and subroutine A[[x]] are fine)
            const rect = t.match(/\b\w+\s*\[(?![\[(])([^\]"]*[()][^\]"]*)\]/);
            if (rect)
                issues.push(`Line ${i + 1}: label "${rect[1].slice(0, 40)}" contains parentheses — wrap the label in double quotes.`);
            const round = t.match(/\b\w+\s*\((?![(\[])([^()"]*[\[\]{}][^()"]*)\)/);
            if (round)
                issues.push(`Line ${i + 1}: label "${round[1].slice(0, 40)}" contains brackets/braces — wrap the label in double quotes.`);
        });
        const opens = lines.filter((l) => /^\s*subgraph\b/.test(l)).length;
        const ends = lines.filter((l) => /^\s*end\s*$/.test(l)).length;
        if (opens !== ends)
            issues.push(`subgraph/end mismatch: ${opens} subgraph vs ${ends} end.`);
        if (!lines.some((l) => /(-->|---|==>|-\.->|--o|--x|<-->)/.test(l)))
            issues.push('Flowchart has no edges.');
    }
    if (type === 'sequenceDiagram') {
        const opens = lines.filter((l) => /^\s*(alt|opt|loop|par|critical|break|rect)\b/.test(l)).length;
        const ends = lines.filter((l) => /^\s*end\s*$/.test(l)).length;
        if (opens !== ends)
            issues.push(`Block mismatch: ${opens} alt/opt/loop/par/critical/break/rect vs ${ends} "end".`);
        if (!lines.some((l) => /(->>|-->>|->|-->|-x|--x|-\)|--\))/.test(l)))
            issues.push('Sequence diagram has no messages.');
    }
    if (type === 'erDiagram') {
        let inEntity = false;
        lines.forEach((line, i) => {
            const t = line.trim();
            if (/\{\s*$/.test(t) && !/[|}o][|o](--|\.\.)[|o][|{]/.test(t)) {
                inEntity = true;
                return;
            }
            if (t === '}') {
                inEntity = false;
                return;
            }
            if (inEntity && /\(/.test(t))
                issues.push(`Line ${i + 1}: attribute types must be one word (use "varchar", not "varchar(255)") — "${t.slice(0, 60)}"`);
            if (!inEntity && /[|}o][|o](--|\.\.)[|o][|{]/.test(t) && !/:\s*\S/.test(t)) {
                issues.push(`Line ${i + 1}: relationship needs a label, e.g.  A ||--o{ B : "has" — "${t.slice(0, 60)}"`);
            }
        });
        const o = (stripped.match(/\{\s*$/gm) ?? []).length;
        const c = (stripped.match(/^\s*\}\s*$/gm) ?? []).length;
        if (o !== c)
            issues.push(`Entity block mismatch: ${o} opening vs ${c} closing braces.`);
    }
    if (type === 'classDiagram' || type === 'stateDiagram-v2') {
        const o = (stripped.match(/\{/g) ?? []).length;
        const c = (stripped.match(/\}/g) ?? []).length;
        if (o !== c)
            issues.push(`Unbalanced braces: ${o} "{" vs ${c} "}".`);
    }
    return issues;
}
// ───────────────────────── markdown cleanup ─────────────────────────
/** Shift headings so the shallowest is H3 (the document supplies H2 for the section title). */
export function normalizeHeadings(md) {
    const lines = md.split(/\r?\n/);
    let fenced = false;
    let min = 7;
    for (const l of lines) {
        if (/^\s*```/.test(l))
            fenced = !fenced;
        if (fenced)
            continue;
        const m = l.match(/^(#{1,6})\s+\S/);
        if (m)
            min = Math.min(min, m[1].length);
    }
    if (min >= 3 || min === 7)
        return md;
    const shift = 3 - min;
    fenced = false;
    return lines
        .map((l) => {
        if (/^\s*```/.test(l))
            fenced = !fenced;
        if (fenced)
            return l;
        const m = l.match(/^(#{1,6})(\s+\S.*)$/);
        return m ? '#'.repeat(Math.min(6, m[1].length + shift)) + m[2] : l;
    })
        .join('\n');
}
export function cleanOutput(raw) {
    let s = raw.trim();
    const wrapped = s.match(/^```(?:markdown|md)[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```\s*$/);
    if (wrapped)
        s = wrapped[1].trim();
    const lines = s.split(/\r?\n/);
    if (lines.length > 3 && /^(here('| i)s|sure|certainly|okay|below is)\b.*[:.]\s*$/i.test(lines[0].trim()) && !lines[0].startsWith('#')) {
        s = lines.slice(1).join('\n').trim();
    }
    return normalizeHeadings(s);
}
export function lintSection(def, raw) {
    const content = cleanOutput(raw);
    const issues = [];
    const min = def.minChars ?? 400;
    if (content.length < min)
        issues.push(`Section is too short (${content.length} chars; expected at least ${min}). Provide full, specific content.`);
    if (/lorem ipsum|\[insert[^\]]*\]|<placeholder>|\bTODO:/i.test(content))
        issues.push('Contains placeholder text; replace it with real content.');
    const fenceLines = content.split(/\r?\n/).filter((l) => /^\s*```/.test(l)).length;
    if (fenceLines % 2 !== 0)
        issues.push('Unclosed code fence (odd number of ``` lines).');
    const diagrams = extractDiagrams(content);
    diagrams.forEach((d, i) => {
        for (const msg of lintMermaid(d.code, d.type))
            issues.push(`Diagram ${i + 1} (${d.type}): ${msg}`);
    });
    for (const req of def.diagrams ?? []) {
        const need = req.min ?? 1;
        const have = diagrams.filter((d) => d.type === req.type).length;
        if (have < need)
            issues.push(`Needs at least ${need} \`${req.type}\` diagram(s) in \`\`\`mermaid blocks; found ${have}.`);
    }
    return { content, diagrams, issues };
}
