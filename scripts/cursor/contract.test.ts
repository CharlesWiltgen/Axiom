import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  CURSOR_ALLOWED_AGENT_FIELDS,
  CURSOR_ALLOWED_AGENT_TOOLS,
  CURSOR_FORCED_FOREGROUND,
  CURSOR_HOOK_DISPOSITIONS,
  CURSOR_INJECTED_ROUTER,
  CURSOR_READONLY_TOOLS,
  CURSOR_HOOK_EXPECTATIONS,
  CURSOR_RELEASE_PROFILE,
  classifyAgentTools,
} from "./contract.ts";
import {
  isGeneratedSubSkill,
  parseAgentTools,
} from "../inline-auditors.ts";

const root = process.cwd();
const pluginRoot = path.join(root, ".claude-plugin", "plugins", "axiom");
const skillsRoot = path.join(pluginRoot, "skills");
const agentsRoot = path.join(pluginRoot, "agents");

function markdownFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
    });
}

const filesystemRouters = fs
  .readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const manifest = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, "claude-code.json"), "utf8"),
) as {
  skills: Array<{ name: string }>;
  commands: string[];
};
const manifestRouters = manifest.skills.map(({ name }) => name).sort();
const agentFiles = fs
  .readdirSync(agentsRoot)
  .filter((name) => name.endsWith(".md"))
  .sort();
const commandFiles = manifest.commands.map((file) => path.basename(file)).sort();
const hooksDocument = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, "hooks", "hooks.json"), "utf8"),
) as {
  hooks: Record<string, Array<{ matcher?: string; hooks: unknown[] }>>;
};
const globalHookEvents = Object.keys(hooksDocument.hooks);
const globalHookEntries = Object.entries(hooksDocument.hooks).flatMap(
  ([event, entries]) => entries.map((entry) => ({ event, entry })),
);
const agentFrontmatter = new Map(
  agentFiles.map((filename) => [
    filename,
    matter(fs.readFileSync(path.join(agentsRoot, filename), "utf8")).data as Record<string, unknown>,
  ]),
);
const perAgentHookOwners = agentFiles.filter((filename) =>
  agentFrontmatter.get(filename)?.hooks !== undefined,
);

function hookDispositionKey(event: string, matcher?: string): string {
  return matcher ? `${event}(${matcher})` : event;
}

const sourceHookDispositionKeys = [
  ...globalHookEntries.map(({ event, entry }) =>
    hookDispositionKey(event, entry.matcher),
  ),
  ...new Set(
    perAgentHookOwners.flatMap((filename) =>
      Object.keys(agentFrontmatter.get(filename)?.hooks as Record<string, unknown>)
        .map((event) => `per-agent ${event}`),
    ),
  ),
];

const sourceAgentClasses = { readonlyBackground: 0, writableBackground: 0, writableForeground: 0 };
const sourceWritableBackground: string[] = [];
const sourceWritableForeground: string[] = [];
for (const filename of agentFiles) {
  const content = fs.readFileSync(path.join(agentsRoot, filename), "utf8");
  const parsed = parseAgentTools(content);
  assert.equal(parsed.kind, "ok", `${filename} must have parseable tools`);
  const tools = parsed.kind === "ok" ? parsed.tools : [];
  const readonly = tools.length > 0 && tools.every((tool) =>
    ["Glob", "Grep", "Read"].includes(tool),
  );
  const background = /^background:\s*true\s*$/m.test(content);
  const className = `${readonly ? "readonly" : "writable"}${background ? "Background" : "Foreground"}` as keyof typeof sourceAgentClasses;
  if (className !== "readonlyBackground" && className !== "writableBackground" && className !== "writableForeground") {
    throw new Error(`unexpected source agent class ${className}`);
  }
  sourceAgentClasses[className]++;
  if (className === "writableBackground") sourceWritableBackground.push(filename.replace(/\.md$/, ""));
  if (className === "writableForeground") sourceWritableForeground.push(filename.replace(/\.md$/, ""));
}

const generatedMirrorCount = markdownFiles(skillsRoot).filter((file) =>
  isGeneratedSubSkill(fs.readFileSync(file, "utf8")),
).length;

test("canonical Cursor inventory preserves the intentional router exception", () => {
  assert.deepEqual(
    filesystemRouters.filter((name) => !manifestRouters.includes(name)),
    [CURSOR_INJECTED_ROUTER],
    "only the injected router may be absent from the canonical manifest",
  );
  assert.deepEqual(
    manifestRouters.filter((name) => !filesystemRouters.includes(name)),
    [],
    "every manifest router must exist on disk",
  );
  assert.ok(filesystemRouters.length > 0 && agentFiles.length > 0 && commandFiles.length > 0);
});

test("every canonical agent falls into a class Cursor can release", () => {
  // The module-scope scan throws on an unexpected class, so this asserts the classes are
  // populated as the Cursor release rules require rather than restating that sum.
  assert.ok(
    sourceAgentClasses.readonlyBackground > 0,
    "read-only background agents are the class Cursor releases as background",
  );
  assert.ok(
    sourceAgentClasses.writableForeground > 0,
    "writable agents must exist and must be released foreground",
  );
  assert.deepEqual(
    sourceWritableBackground.filter((name) => !CURSOR_FORCED_FOREGROUND.has(name)),
    [],
    "a writable background agent must be acknowledged in the reviewed forced-foreground set",
  );
  assert.equal(
    generatedMirrorCount,
    markdownFiles(skillsRoot).filter((file) => isGeneratedSubSkill(fs.readFileSync(file, "utf8"))).length,
    "the mirror count must match an independent recount of generated sub-skills",
  );
});

test("the closed Cursor source contract preserves its release policy", () => {
  assert.deepEqual(CURSOR_HOOK_EXPECTATIONS, {
    globalHookEventTypes: 5,
    globalHookEntries: 6,
    perAgentHooks: 6,
  });
  assert.equal(CURSOR_INJECTED_ROUTER, "axiom-tools");
  assert.equal(CURSOR_RELEASE_PROFILE, "full");
  assert.deepEqual([...CURSOR_READONLY_TOOLS], ["Glob", "Grep", "Read"]);
  assert.deepEqual([...CURSOR_ALLOWED_AGENT_TOOLS], [
    "Glob",
    "Grep",
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Agent",
  ]);
  assert.deepEqual([...CURSOR_ALLOWED_AGENT_FIELDS], [
    "name",
    "description",
    "model",
    "background",
    "color",
    "tools",
    "skills",
    "hooks",
    "mcp",
    "exempt-from-routing",
  ]);
});

test("hook counts and dispositions remain tied to canonical sources", () => {
  assert.equal(globalHookEvents.length, 5);
  assert.equal(globalHookEntries.length, 6);
  assert.equal(perAgentHookOwners.length, 6);
  assert.equal(globalHookEvents.length, CURSOR_HOOK_EXPECTATIONS.globalHookEventTypes);
  assert.equal(globalHookEntries.length, CURSOR_HOOK_EXPECTATIONS.globalHookEntries);
  assert.equal(perAgentHookOwners.length, CURSOR_HOOK_EXPECTATIONS.perAgentHooks);
  assert.deepEqual(
    [...new Set(Object.keys(CURSOR_HOOK_DISPOSITIONS))].sort(),
    [...new Set(sourceHookDispositionKeys)].sort(),
  );

  for (const { event, entry } of globalHookEntries) {
    const key = hookDispositionKey(event, entry.matcher);
    let expected: string;
    if (event === "SessionStart" && entry.matcher === undefined) {
      expected = "sessionStart.additional_context";
    } else if (event === "UserPromptSubmit" && entry.matcher === undefined) {
      expected = "beforeSubmitPrompt.additional_context";
    } else if (event === "PreToolUse" && entry.matcher === "Read") {
      expected = "omitted";
    } else if (
      event === "PostToolUse" &&
      (entry.matcher === "Bash" || entry.matcher === "Write|Edit")
    ) {
      expected = "postToolUse.additional_context";
    } else if (event === "SubagentStart" && entry.matcher === undefined) {
      expected = "prompt";
    } else {
      throw new Error(`unreviewed canonical global hook: ${key}`);
    }
    assert.equal(
      CURSOR_HOOK_DISPOSITIONS[key as keyof typeof CURSOR_HOOK_DISPOSITIONS],
      expected,
    );
  }

  for (const filename of perAgentHookOwners) {
    const hooks = agentFrontmatter.get(filename)?.hooks;
    assert.ok(hooks && typeof hooks === "object", `${filename} hooks must be a mapping`);
    for (const event of Object.keys(hooks as Record<string, unknown>)) {
      assert.equal(
        CURSOR_HOOK_DISPOSITIONS[`per-agent ${event}` as keyof typeof CURSOR_HOOK_DISPOSITIONS],
        "advisory",
      );
    }
  }
});

test("released foreground policy follows source agent frontmatter", () => {
  assert.deepEqual(sourceWritableBackground, ["screenshot-validator"]);
  const releasedWritableForeground = [
    ...sourceWritableForeground,
    ...sourceWritableBackground.filter((name) => CURSOR_FORCED_FOREGROUND.has(name)),
  ].sort();
  assert.equal(
    releasedWritableForeground.length,
    sourceWritableForeground.length + sourceWritableBackground.length,
    "every writable background agent must be covered by the forced-foreground policy",
  );
  assert.ok(releasedWritableForeground.includes("screenshot-validator"));
});

test("agent tool classification fails closed and preserves read-only authority", () => {
  assert.equal(classifyAgentTools(["Glob", "Grep", "Read"]), "readonly");
  assert.equal(classifyAgentTools(["Read", "Write"]), "writable");
  assert.equal(classifyAgentTools(["Bash"]), "writable");
  assert.throws(() => classifyAgentTools([]), /empty agent tool list/);
  assert.throws(() => classifyAgentTools(["Read", "Unknown"]), /unknown agent tool: Unknown/);
});

test("Apple-docs local references name files that exist in the canonical tree", () => {
  const skillPath = path.join(
    skillsRoot,
    "axiom-apple-docs",
    "SKILL.md",
  );
  const content = fs.readFileSync(skillPath, "utf8");
  const pointer = "skills/apple-docs-research.md";
  assert.match(content, new RegExp(`\\(${pointer.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")}\\)`));
  assert.ok(fs.existsSync(path.join(path.dirname(skillPath), pointer)));
});
