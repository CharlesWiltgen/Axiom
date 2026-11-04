/**
 * "MCP-only clients:" notes give the MCP form of a CLI instruction in canonical agent and
 * command text, for clients that have the `axiom_<binary>_*` tools but no shell binary:
 * inline after the instruction, as in
 *   `xcsym verify <file>` (MCP-only clients: `axiom_xcsym_verify` with `file`)
 * or as a line after a fenced block or table, one `; `-separated entry per command (a single
 * entry covers every command of its tool). A leaf module with no imports: root scripts load
 * it as `.ts` under bare-node type-stripping, and the MCP server as `./mcp-notes.js`.
 */
// The note grammar, shared by the stripper and the checker so the two cannot disagree on
// what a note is. Any "MCP-only clients:" left after stripping is in neither form.
const NOTE_LABEL = 'MCP-only clients:';
const INLINE_NOTE = / \(MCP-only clients: ((?:`[^`\n]*`|\([^()\n]*\)|[^()`\n])*)\)/g;
const LINE_NOTE_START = String.raw `[ \t]*MCP-only clients: `;
const LINE_NOTE = new RegExp(`^${LINE_NOTE_START}(.*)$`);
const PARAGRAPH_NOTE = new RegExp(`(?<=^|\\n\\n)${LINE_NOTE_START}[^\\n]*\\n(?:\\n|$)`, 'g');
const LINE_NOTES = new RegExp(`^${LINE_NOTE_START}[^\\n]*\\n?`, 'gm');
/** The indexes of lines inside fenced code blocks, fences included. Notes never belong there. */
function fencedLines(lines) {
    return new Set(fencesIn(lines).flatMap((f) => Array.from({ length: f.close - f.open + 1 }, (_v, k) => f.open + k)));
}
/**
 * The text without its notes, for harnesses that run the binaries or render their own MCP form.
 * A note inside a code block is left in place: nothing checks it there, so the checker reports it.
 */
export function stripMcpClientNotes(text) {
    const lines = text.split('\n');
    const fenced = fencedLines(lines);
    const held = lines.map((line, i) => (fenced.has(i) ? `\u0000${i}\u0000` : line)).join('\n');
    return held.replace(INLINE_NOTE, '').replace(PARAGRAPH_NOTE, '').replace(LINE_NOTES, '')
        .replace(/\u0000(\d+)\u0000/g, (_m, i) => lines[Number(i)]);
}
/** Every recognized note's body outside code blocks, inline and line notes alike, in text order. */
export function mcpClientNoteBodies(text) {
    const lines = text.split('\n');
    const fenced = fencedLines(lines);
    return lines.flatMap((line, i) => (fenced.has(i) ? [] : [
        ...[...line.matchAll(INLINE_NOTE)].map((m) => m[1]),
        ...(line.match(LINE_NOTE)?.slice(1, 2) ?? []),
    ]));
}
/** "MCP-only clients:" lines nothing strips or checks: inside a code block, or in neither recognized form. */
export function unrecognizedMcpClientNotes(text) {
    const lines = text.split('\n');
    const fenced = fencedLines(lines);
    return lines.flatMap((line, i) => {
        if (!line.includes(NOTE_LABEL))
            return [];
        if (fenced.has(i))
            return [{ line: line.trim(), fenced: true }];
        return LINE_NOTE.test(line) || !line.replace(INLINE_NOTE, '').includes(NOTE_LABEL) ? [] : [{ line: line.trim(), fenced: false }];
    });
}
/**
 * Flags and binary-prefixed env vars (as camelCase) that a wrapped CLI takes but its MCP tools
 * have no param for, because the server supplies or never needs them.
 */
export const MCP_IMPLIED_FLAGS = {
    xcprof: ['json', 'both', 'human', 'open', 'noPrompt', 'traceRoot'],
};
const camel = (s) => s.toLowerCase().replace(/[-_]([a-z0-9])/g, (_m, c) => c.toUpperCase());
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const unquote = (s) => s.replace(/^"([^"]*)"$|^'([^']*)'$/, '$1$2');
/** A note body's `; `-separated entries, splitting only outside backticked values. */
function splitEntries(body) {
    const entries = [];
    let inCode = false;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
        if (body[i] === '`')
            inCode = !inCode;
        else if (!inCode && body[i] === ';' && /\s/.test(body[i + 1] ?? '')) {
            entries.push(body.slice(start, i));
            start = i + 2;
            while (/\s/.test(body[start] ?? ''))
                start++;
            i = start - 1;
        }
    }
    entries.push(body.slice(start));
    return entries;
}
const ENV_PREFIX = /^\s*(?:env\s+)?((?:[A-Z_][A-Z0-9_]*=(?:"[^"]*"|'[^']*'|(?:\$\([^)]*\)|[^\s"'])*)\s+)*)/;
function noteEntries(body) {
    return splitEntries(body).flatMap((entry) => {
        const named = entry.match(/`(axiom_[a-z0-9_]+)`/);
        const tool = named?.[1] ?? '';
        const params = named ? entry.slice(named.index + named[0].length) : entry;
        const given = [];
        const omitted = [];
        const values = new Map();
        let end = 0;
        let lastOmitted = false;
        const param = tool ? /`([A-Za-z]\w*)(?::\s*([^`]*))?`/g : /`([a-z][A-Za-z0-9]*)(?::\s*([^`]*))?`/g;
        for (const p of params.matchAll(param)) {
            const gap = params.slice(end, p.index);
            const isOmitted = /\bno\s*$/.test(gap) || (lastOmitted && /^\s*,?\s*(?:or\s+)?$/.test(gap));
            (isOmitted ? omitted : given).push(p[1]);
            if (p[2] !== undefined && !values.has(p[1]))
                values.set(p[1], p[2].trim());
            lastOmitted = isOmitted;
            end = p.index + p[0].length;
        }
        return tool || given.length > 0 ? [{ tool, given, omitted, values }] : [];
    });
}
/** Split a shell line at `&&`, `||`, `;`, `|` and a lone `&` outside quotes. */
function shellSegments(line) {
    const segments = [];
    let quote = '';
    let start = 0;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
            if (c === quote)
                quote = '';
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
            continue;
        }
        // A lone & backgrounds the command before it; `>&` and `&>` are redirections.
        const background = c === '&' && line[i + 1] !== '&' && line[i - 1] !== '>' && line[i + 1] !== '>';
        if (c === ';' || c === '|' || (c === '&' && line[i + 1] === '&') || background) {
            segments.push(line.slice(start, i));
            if ((c === '|' && line[i + 1] === '|') || (c === '&' && line[i + 1] === '&'))
                i++;
            start = i + 1;
        }
    }
    segments.push(line.slice(start));
    return segments;
}
// Words that run the command after them: shell keywords and wrappers like sudo or timeout.
const COMMAND_OPENER = /^(?:(?:if|then|do|else|elif|while|until|!|sudo|time|exec|nohup|xargs(?:\s+-\S+)*|timeout\s+\S+)\s+|[({]\s*)+/;
// A binary named by path ("$ROOT/tools/xcsym", <plugin-root>/tools/xcsym) runs as its basename.
const BINARY_PATH = /^"?[^\s"]*\/([a-z][a-z0-9]*)"?(?=\s|$)/;
/** The wrapped commands a shell line or backticked span runs, one per segment that opens with one. */
function commandsIn(line, subcommands) {
    const substituted = [...line.matchAll(/\$\(([^()]*)\)/g)].flatMap((m) => commandsIn(m[1], subcommands));
    return [...substituted, ...shellSegments(line).flatMap((segment) => {
            const envRun = segment.match(ENV_PREFIX)?.[1] ?? '';
            const rest = segment.slice(segment.match(ENV_PREFIX)?.[0].length ?? 0).trim()
                .replace(COMMAND_OPENER, '').replace(BINARY_PATH, '$1');
            const subcommand = subcommands.find((sub) => rest === sub || (rest.startsWith(sub) && /^[^\w-]/.test(rest.slice(sub.length))));
            if (!subcommand)
                return [];
            const options = rest.split(/\s--(?=\s|$)/)[0];
            const flags = [...options.matchAll(/(?:^|\s)--([a-z][a-z0-9-]*)/g)].map((f) => f[1]);
            const shortFlags = [...options.matchAll(/(?:^|\s)-([A-Za-z])(?=\s|=|$)/g)].map((f) => f[1]);
            const flagValues = new Map([...options.matchAll(/(?:^|\s)--([a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|\S+)|\s+("[^"]*"|'[^']*'))/g)]
                .map((f) => [f[1], unquote(f[2] ?? f[3])]));
            const envs = [...envRun.matchAll(/([A-Z_][A-Z0-9_]*)=/g)].map((e) => e[1]);
            return [{ subcommand, cli: `${envRun}${rest}`.trim(), hasArgs: rest !== subcommand, flags, shortFlags, envs, flagValues }];
        })];
}
function fencesIn(lines) {
    const fences = [];
    let open = null;
    lines.forEach((line, i) => {
        const m = line.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
        if (!m)
            return;
        if (!open)
            open = { at: i, char: m[1][0], width: m[1].length };
        else if (m[1][0] === open.char && m[1].length >= open.width && m[2].trim() === '') {
            fences.push({ open: open.at, close: i });
            open = null;
        }
    });
    if (open)
        fences.push({ open: open.at, close: lines.length });
    return fences;
}
/**
 * Disagreements between the notes in served agent or command text and the server's
 * `listTools()` schemas: `tools` are the wrapped binaries' tools, `otherTools` every other
 * registered tool. Every wrapped instruction (a backticked command with arguments, or a fenced
 * line) needs its own note naming a wrapped tool, and a bare subcommand name needs some note
 * naming its tool, unless `requireNotes` is false. Every tool a note names must be registered;
 * its params must exist, include its required inputs (given, not `no \`x\``) and hold values its
 * schema allows; and every flag or binary-prefixed env var of the command it follows must map to
 * a param the note names, unless the server implies it. A note that names only params is held to
 * the family of the command before it. One entry per tool covers all of that tool's commands in
 * a block; otherwise entries pair with commands in order. A note in neither recognized form is
 * reported too, since nothing strips or checks it.
 */
export function mcpClientNoteMismatches(text, tools, impliedFlags = MCP_IMPLIED_FLAGS, otherTools = [], { requireNotes = true } = {}) {
    const byName = new Map([...tools, ...otherTools].map((t) => [t.name, t]));
    const toolForSubcommand = new Map();
    const families = new Set();
    for (const t of tools) {
        const m = t.name.match(/^axiom_([a-z0-9]+)_([a-z0-9_]+)$/);
        if (!m)
            continue;
        families.add(m[1]);
        toolForSubcommand.set(`${m[1]} ${m[2].replace(/_/g, '-')}`, t.name);
    }
    const subcommands = [...toolForSubcommand.keys()].sort((a, b) => b.length - a.length);
    // Every pattern here reads LF lines; CRLF would leave fences and line notes unseen.
    if (text.includes('\r\n'))
        return ['text uses CRLF line endings; MCP-only clients notes are checked only in LF text'];
    const clip = (line) => (line.length > 120 ? `${line.slice(0, 117)}…` : line);
    const problems = unrecognizedMcpClientNotes(text).map(({ line, fenced }) => (fenced
        ? `MCP-only clients note inside a code block, where nothing checks it: "${clip(line)}"`
        : `MCP-only clients note in an unrecognized form: "${clip(line)}"`));
    const noted = new Set();
    const ours = (tool) => families.has(tool.split('_')[1]);
    const checkValue = (toolName, prop, param, value) => {
        if (value === undefined || value.includes('<'))
            return;
        const schema = (prop ?? {});
        const literal = value.match(/^"([^"]*)"$/)?.[1] ?? (/^[A-Za-z][\w.-]*$/.test(value) && !/^(?:true|false|null)$/.test(value) ? value : undefined);
        if (schema.enum && literal !== undefined && !schema.enum.includes(literal)) {
            problems.push(`note gives \`${toolName}\` \`${param}: ${value}\`, which is not one of ${schema.enum.map((e) => `"${e}"`).join(', ')}`);
        }
        if (schema.type === 'boolean' && value !== 'true' && value !== 'false') {
            problems.push(`note gives \`${toolName}\` \`${param}: ${value}\`, which is not a boolean`);
        }
    };
    // A note that names only params: each must belong to some tool of the family in play.
    const checkParamsOnly = (entry, family) => {
        const candidates = tools.filter((t) => !family || t.name.startsWith(`axiom_${family}_`));
        for (const p of [...entry.given, ...entry.omitted]) {
            const owner = candidates.find((t) => p in (t.inputSchema.properties ?? {}));
            if (!owner)
                problems.push(`note names \`${p}\`, which no ${family ? `\`${family}\`` : 'wrapped'} tool takes`);
            else
                checkValue(owner.name, owner.inputSchema.properties?.[p], p, entry.values.get(p));
        }
    };
    const check = (entry, command) => {
        noted.add(entry.tool);
        const tool = byName.get(entry.tool);
        if (!tool) {
            problems.push(`note names \`${entry.tool}\`, which the server does not register`);
            return;
        }
        const props = tool.inputSchema.properties ?? {};
        const named = [...entry.given, ...entry.omitted];
        for (const p of named) {
            if (!(p in props))
                problems.push(`note gives \`${entry.tool}\` \`${p}\`, which it lacks`);
            else
                checkValue(entry.tool, props[p], p, entry.values.get(p));
        }
        for (const r of tool.inputSchema.required ?? []) {
            if (!entry.given.includes(r))
                problems.push(`note for \`${entry.tool}\` omits required \`${r}\``);
        }
        if (!command)
            return;
        const expected = toolForSubcommand.get(command.subcommand);
        if (expected !== entry.tool) {
            problems.push(`\`${command.cli}\` is followed by a note for \`${entry.tool}\`; expected \`${expected}\``);
            return;
        }
        for (const f of command.shortFlags) {
            problems.push(`\`${command.cli}\` passes \`-${f}\`; write the long flag so its note can be checked`);
        }
        const binary = command.subcommand.split(' ')[0];
        const implied = impliedFlags[binary] ?? [];
        const inputs = [
            ...command.flags.map((flag) => ({ shown: `passes \`--${flag}\``, name: camel(flag) })),
            ...command.envs.filter((env) => env.startsWith(`${binary.toUpperCase()}_`))
                .map((env) => ({ shown: `sets \`${env}\``, name: camel(env.slice(binary.length + 1)) })),
        ];
        for (const { shown, name } of inputs) {
            if (implied.includes(name))
                continue;
            const param = [name, `${name}s`].find((n) => n in props);
            if (!param)
                problems.push(`\`${command.cli}\` ${shown}, which \`${entry.tool}\` has no param for`);
            else if (!named.includes(param))
                problems.push(`\`${command.cli}\` ${shown}; its note for \`${entry.tool}\` omits \`${param}\``);
        }
        // The note is the command's MCP form, so it may not contradict a literal the command passes
        // or switch on a consent gate the command leaves off.
        for (const [flag, value] of command.flagValues) {
            const noteValue = entry.values.get(camel(flag));
            if (value.includes('<') || noteValue === undefined || noteValue.includes('<'))
                continue;
            if (unquote(noteValue) !== value) {
                problems.push(`\`${command.cli}\` passes \`--${flag}=${value}\`; its note for \`${entry.tool}\` gives \`${camel(flag)}: ${noteValue}\``);
            }
        }
        for (const p of entry.given.filter((g) => /^allow[A-Z]/.test(g) && entry.values.get(g) === 'true')) {
            if (!command.flags.includes(kebab(p))) {
                problems.push(`note for \`${entry.tool}\` sets \`${p}: true\`, which \`${command.cli}\` does not pass (\`--${kebab(p)}\`)`);
            }
        }
    };
    // Check a note's entries against the commands it follows: one entry per tool covers all of
    // that tool's commands; otherwise entries pair with commands in order.
    const checkNote = (entries, commands, family) => {
        entries.filter((e) => !e.tool).forEach((entry) => checkParamsOnly(entry, family));
        const wrapped = entries.filter((e) => e.tool && ours(e.tool));
        const others = entries.filter((e) => e.tool && !ours(e.tool));
        others.forEach((entry) => check(entry));
        if (commands.length === 0) {
            wrapped.forEach((entry) => check(entry));
            return;
        }
        const toolOf = (c) => toolForSubcommand.get(c.subcommand);
        const perTool = [...new Set(commands.map(toolOf))].every((tool) => wrapped.filter((e) => e.tool === tool).length === 1)
            && wrapped.every((e) => commands.some((c) => toolOf(c) === e.tool));
        if (perTool) {
            commands.forEach((c) => check(wrapped.find((e) => e.tool === toolOf(c)), c));
        }
        else if (commands.length === wrapped.length) {
            wrapped.forEach((entry, n) => check(entry, commands[n]));
        }
        else {
            const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
            problems.push(`note after a block of ${plural(commands.length, 'command')} lists ${plural(wrapped.length, 'tool')}`);
            wrapped.forEach((entry) => check(entry));
        }
    };
    const lines = text.split('\n');
    const fences = fencesIn(lines);
    const fenceAt = new Map();
    for (const f of fences)
        for (let i = f.open; i <= f.close; i++)
            fenceAt.set(i, f);
    const coveredFences = new Set();
    const prose = [];
    const spans = [];
    lines.forEach((line, i) => {
        if (fenceAt.has(i))
            return;
        let stripped = line;
        for (const m of line.matchAll(/`([^`\n]+)`/g)) {
            const commands = commandsIn(m[1], subcommands);
            if (commands.length === 0)
                continue;
            const instruction = commands.some((c) => c.hasArgs);
            spans.push({ line: i, end: m.index + m[0].length, commands, instruction, covered: false });
            if (instruction)
                stripped = stripped.replace(m[0], '');
        }
        if (!LINE_NOTE.test(line))
            prose.push(stripped);
    });
    // The family of the last wrapped command before (line, column), for notes that name only params.
    const familyOf = (c) => c.subcommand.split(' ')[0];
    const occurrences = [
        ...spans.map((s) => ({ line: s.line, column: s.end, family: familyOf(s.commands.at(-1)) })),
        ...fences.flatMap((f) => {
            const last = lines.slice(f.open + 1, f.close).flatMap((l) => commandsIn(l, subcommands)).at(-1);
            return last ? [{ line: f.close, column: Number.MAX_SAFE_INTEGER, family: familyOf(last) }] : [];
        }),
    ].sort((a, b) => a.line - b.line || a.column - b.column);
    const familyBefore = (line, column) => occurrences.filter((o) => o.line < line || (o.line === line && o.column <= column)).at(-1)?.family;
    lines.forEach((line, i) => {
        if (fenceAt.has(i))
            return;
        for (const m of line.matchAll(INLINE_NOTE)) {
            const span = spans.find((s) => s.line === i && s.end === m.index);
            const entries = noteEntries(m[1]);
            // A flag named in prose: its note must name the param the flag maps to.
            const flagSpan = line.slice(0, m.index).match(/`(--([a-z][a-z0-9-]*)[^`]*)`$/);
            if (flagSpan) {
                const param = camel(flagSpan[2]);
                const family = familyBefore(i, m.index);
                const named = entries.flatMap((e) => [...e.given, ...e.omitted]);
                if (!named.includes(param) && !named.includes(`${param}s`) && !(family && impliedFlags[family]?.includes(param))) {
                    problems.push(`\`${flagSpan[1]}\` is followed by a note that does not name \`${param}\``);
                }
            }
            if (span?.instruction && !entries.some((e) => e.tool && ours(e.tool))) {
                problems.push(`note for \`${span.commands[0].cli}\` names no wrapped tool`);
                span.covered = true;
                continue;
            }
            if (span)
                span.covered = true;
            checkNote(entries, span?.commands ?? [], familyBefore(i, m.index));
        }
        const note = line.match(LINE_NOTE);
        if (!note)
            return;
        const entries = noteEntries(note[1]);
        let k = i - 1;
        while (k >= 0 && lines[k].trim() === '')
            k--;
        let commands = [];
        const fence = fenceAt.get(k);
        if (fence && fence.close === k) {
            coveredFences.add(fence);
            const body = lines.slice(fence.open + 1, fence.close).join('\n').replace(/\s*\\\n\s*/g, ' ').split('\n');
            commands = body.flatMap((l) => commandsIn(l, subcommands));
        }
        else if (k >= 0 && lines[k].trimStart().startsWith('|')) {
            const rows = spans.filter((s) => s.instruction && !s.covered && s.line <= k
                && lines.slice(s.line, k + 1).every((l) => l.trimStart().startsWith('|')));
            rows.forEach((s) => { s.covered = true; });
            commands = rows.flatMap((s) => s.commands);
        }
        if (commands.length === 0) {
            for (const entry of entries.filter((e) => e.tool && ours(e.tool)))
                problems.push(`note for \`${entry.tool}\` follows no command`);
        }
        checkNote(entries, commands, familyBefore(i, 0));
    });
    if (requireNotes) {
        for (const s of spans) {
            if (s.instruction && !s.covered)
                problems.push(`\`${s.commands.find((c) => c.hasArgs).cli}\` has no MCP-only clients note`);
        }
        for (const f of fences) {
            if (coveredFences.has(f))
                continue;
            const first = lines.slice(f.open + 1, f.close).flatMap((l) => commandsIn(l, subcommands))[0];
            if (first)
                problems.push(`block with \`${first.cli}\` has no MCP-only clients note`);
        }
        const proseText = prose.join('\n');
        for (const [subcommand, tool] of toolForSubcommand) {
            if (new RegExp(`(?<![\\w-])${subcommand}(?![\\w-])`).test(proseText) && !noted.has(tool)) {
                problems.push(`\`${subcommand}\` has no MCP-only clients note naming \`${tool}\``);
            }
        }
    }
    return [...new Set(problems)];
}
/**
 * Text for an MCP-only harness: each wrapped command whose note covers it exactly becomes the
 * note's MCP call. An inline note covers the backticked command just before it when every entry
 * names one of that command's tools. A line note covers the fence before it when every entry
 * names a tool and pairs with the fence's wrapped lines one per tool or in order, with each line
 * running one wrapped command and none continued. Anything else is left as is, notes included,
 * for `stripMcpClientNotes` and the harness's own rewrites.
 */
export function renderMcpClientNotes(text, toolForSubcommand) {
    const subcommands = [...toolForSubcommand.keys()].sort((a, b) => b.length - a.length);
    const tools = new Set(toolForSubcommand.values());
    // Every entry must open with a wrapped tool: a call, not prose that mentions one.
    const calls = (body) => {
        const raw = splitEntries(body.replace(/\.$/, ''));
        const named = raw.map((entry) => entry.match(/^`(axiom_[a-z0-9_]+)`/)?.[1]);
        return named.every((t) => t !== undefined && tools.has(t)) ? raw.map((entry, i) => ({ tool: named[i], text: entry })) : null;
    };
    const toolOf = (c) => toolForSubcommand.get(c.subcommand);
    const lines = text.split('\n');
    const fences = fencesIn(lines);
    const fenced = new Set(fences.flatMap((f) => Array.from({ length: f.close - f.open + 1 }, (_v, k) => f.open + k)));
    for (const f of fences) {
        let k = f.close + 1;
        while (k < lines.length && lines[k].trim() === '')
            k++;
        const note = k < lines.length ? lines[k].match(LINE_NOTE) : null;
        const entries = note ? calls(note[1]) : null;
        const body = Array.from({ length: Math.max(0, f.close - f.open - 1) }, (_v, n) => f.open + 1 + n);
        if (!entries || body.some((i) => /\\\s*$/.test(lines[i]) || lines[i].includes('<<')))
            continue;
        const wrapped = body.map((i) => ({ i, commands: commandsIn(lines[i], subcommands) })).filter((w) => w.commands.length > 0);
        // Replace only a line that is nothing but the command: no pipe, fallback, substitution or opener.
        const bare = (line) => shellSegments(line).length === 1 && !line.includes('$(')
            && !COMMAND_OPENER.test(line.slice(line.match(ENV_PREFIX)?.[0].length ?? 0).trim());
        if (wrapped.length === 0 || wrapped.some((w) => w.commands.length > 1 || !bare(lines[w.i])))
            continue;
        const lineTools = wrapped.map((w) => toolOf(w.commands[0]));
        // One entry per tool may stand for a line only when that tool has just that line.
        const perTool = new Set(lineTools).size === lineTools.length
            && lineTools.every((t) => entries.filter((e) => e.tool === t).length === 1)
            && entries.every((e) => lineTools.includes(e.tool));
        const inOrder = entries.length === wrapped.length && entries.every((e, n) => e.tool === lineTools[n]);
        if (!perTool && !inOrder)
            continue;
        wrapped.forEach((w, n) => {
            const entry = perTool ? entries.find((e) => e.tool === lineTools[n]) : entries[n];
            lines[w.i] = `${lines[w.i].match(/^[ \t]*/)[0]}Call ${entry.text}.`;
        });
    }
    return lines.map((line, i) => {
        if (fenced.has(i))
            return line;
        let out = line;
        for (const m of [...line.matchAll(INLINE_NOTE)].reverse()) {
            const before = out.slice(0, m.index);
            if (!before.endsWith('`'))
                continue;
            const open = before.lastIndexOf('`', before.length - 2);
            if (open < 0)
                continue;
            const span = before.slice(open + 1, -1);
            // A flag named in prose, whose note names exactly the param it maps to.
            // A literal value (`--format=full`) would be lost, so only a bare or placeholder flag renders.
            const flag = span.match(/^--([a-z][a-z0-9-]*)(?:[ =]<[^`>]*>)?$/)?.[1];
            const param = m[1].match(/^`([a-z][A-Za-z0-9]*)`$/)?.[1];
            if (span.startsWith('--')) {
                if (!flag || !param)
                    continue;
                if (param === camel(flag) || param === `${camel(flag)}s`)
                    out = `${out.slice(0, open)}\`${param}\`${out.slice(m.index + m[0].length)}`;
                continue;
            }
            const commands = commandsIn(span, subcommands);
            const entries = calls(m[1]);
            if (commands.length === 0 || !entries)
                continue;
            const commandTools = new Set(commands.map(toolOf));
            if (!entries.every((e) => commandTools.has(e.tool)) || ![...commandTools].every((t) => entries.some((e) => e.tool === t)))
                continue;
            out = `${out.slice(0, open)}${entries.map((e) => e.text).join('; ')}${out.slice(m.index + m[0].length)}`;
        }
        return out;
    }).join('\n');
}
/** The flags the text passes to wrapped commands, in backticked spans and fences, sorted. */
export function wrappedCommandFlags(text, subcommands) {
    const sorted = [...subcommands].sort((a, b) => b.length - a.length);
    const lines = text.split('\n');
    const fences = fencesIn(lines);
    const fenced = new Set(fences.flatMap((f) => Array.from({ length: f.close - f.open + 1 }, (_v, k) => f.open + k)));
    const commands = [
        ...lines.flatMap((line, i) => (fenced.has(i) ? [] : [...line.matchAll(/`([^`\n]+)`/g)].flatMap((m) => commandsIn(m[1], sorted)))),
        ...fences.flatMap((f) => lines.slice(f.open + 1, f.close).join('\n').replace(/\s*\\\n\s*/g, ' ').split('\n').flatMap((l) => commandsIn(l, sorted))),
    ];
    return [...new Set(commands.flatMap((c) => c.flags))].sort();
}
/**
 * Disagreements between MCP calls written in prose (a backticked `axiom_*` tool, then `with` and
 * its backticked params) and the server's schemas: an unregistered tool, a param it lacks, or a
 * value its schema rejects. A backticked word may also be one of a param's enum values. A clause
 * runs to the next sentence end, `;`, `)` or tool name outside backticks. For text an MCP-only
 * harness ships, whichever source wrote it.
 */
const LIST_GAP = /^[\s,/]*(?:(?:and|or|only|in|the|same|selected|path|plus|any|requested|a|bounded|its|both)[\s,/]+)*$/;
export function mcpCallMismatches(text, tools) {
    const byName = new Map(tools.map((t) => [t.name, t]));
    const problems = [];
    for (const m of text.matchAll(/`(axiom_[a-z0-9_]+)`(?: MCP tool)? with /g)) {
        let end = m.index + m[0].length;
        for (let inCode = false; end < text.length; end++) {
            const c = text[end];
            if (c === '`') {
                if (!inCode && text.startsWith('`axiom_', end))
                    break;
                inCode = !inCode;
            }
            else if (!inCode && (c === '\n' || c === ';' || c === ')' || (c === '.' && /\s|$/.test(text[end + 1] ?? ''))))
                break;
        }
        const tool = byName.get(m[1]);
        if (!tool) {
            problems.push(`\`${m[1]}\` is not a registered tool`);
            continue;
        }
        const props = (tool.inputSchema.properties ?? {});
        const enumValues = new Set(Object.values(props).flatMap((p) => p?.enum ?? []).map(String));
        // The params are the run of backticked words joined by list words; the first other word
        // ("has", "to", "and read") ends the call, so later backticked words are not its params.
        const clause = text.slice(m.index + m[0].length, end);
        const params = [];
        let last = 0;
        for (const p of clause.matchAll(/`([^`]*)`/g)) {
            if (!LIST_GAP.test(clause.slice(last, p.index)))
                break;
            params.push(p);
            last = p.index + p[0].length;
        }
        for (const p of params.flatMap((q) => [...q[0].matchAll(/^`([A-Za-z]\w*)(?::\s*([^`]*))?`$/g)])) {
            const [, name, value] = p;
            if (!(name in props)) {
                if (value === undefined && enumValues.has(name))
                    continue;
                problems.push(`\`${m[1]}\` is given \`${name}\`, which it lacks`);
                continue;
            }
            if (value === undefined || value.includes('<'))
                continue;
            const literal = value.match(/^"([^"]*)"$/)?.[1];
            const schema = props[name] ?? {};
            if (schema.enum && literal !== undefined && !schema.enum.includes(literal)) {
                problems.push(`\`${m[1]}\` is given \`${name}: ${value}\`, which is not one of ${schema.enum.map((e) => `"${e}"`).join(', ')}`);
            }
            if (schema.type === 'boolean' && value !== 'true' && value !== 'false') {
                problems.push(`\`${m[1]}\` is given \`${name}: ${value}\`, which is not a boolean`);
            }
        }
    }
    return [...new Set(problems)];
}
export const FLAG_EXAMPLES = {
    xclog: '`--max-lines` → `maxLines`',
    xcsym: '`--dsym-paths` → `dsymPaths`',
    xcprof: '`--time-limit` → `timeLimit`',
};
const serial = (items) => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`);
/**
 * A note for served agent, skill, prompt and resource text that names a wrapped subcommand or a
 * binary with no MCP tool, or '' when it names neither. That text is written for harnesses that
 * run the CLI, and a section-filtered read can miss the reference that maps a CLI call to its
 * MCP tool. It maps only the subcommands the text names that the server registers.
 */
export function mcpToolFooter(text, toolNames, cliOnly) {
    const found = [];
    for (const tool of toolNames) {
        const m = tool.match(/^axiom_([a-z0-9]+)_([a-z0-9_]+)$/);
        if (!m)
            continue;
        const phrase = `${m[1]} ${m[2].replace(/_/g, '-')}`;
        const at = text.search(new RegExp(`(?<![\\w-])${phrase}(?![\\w-])`));
        if (at >= 0)
            found.push({ binary: m[1], phrase, tool, at });
    }
    found.sort((a, b) => a.at - b.at);
    // The binary by name, or its env var ($AXBUILD); not a capitalized word such as XCUI in prose.
    const unwrapped = cliOnly.filter((b) => new RegExp(`(?<![\\w/.-])${b}(?![\\w-])|\\$\\{?${b.toUpperCase()}\\b`).test(text));
    if (found.length === 0 && unwrapped.length === 0)
        return '';
    const parts = [];
    if (found.length > 0) {
        const flag = FLAG_EXAMPLES[found[0].binary] ?? '`--some-flag` → `someFlag`';
        parts.push(`Over MCP, call these tools instead of the commands above: ${found.map((f) => `\`${f.phrase}\` → \`${f.tool}\``).join(', ')}. Your client may show them with a server prefix, such as \`mcp__axiom__${found[0].tool}\`. Pass each flag as its camelCase input (${flag}); a flag with no matching input is not available over MCP. Pass files as absolute paths: the tools read no stdin or environment variables.`);
    }
    if (unwrapped.length > 0) {
        const one = unwrapped.length === 1;
        parts.push(`${serial(unwrapped.map((b) => `\`${b}\``))} ${one ? 'has no MCP tool' : 'have no MCP tools'}: where the text gives a fallback, use it; otherwise ask the user to run those steps.`);
    }
    return `**Axiom MCP tools** – ${parts.join(' ')}`;
}
