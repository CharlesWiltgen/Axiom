import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { isGeneratedSubSkill, parseAgentTools } from "../inline-auditors.ts";
import { compareCursorPaths } from "./compare.ts";
import {
  CURSOR_ALLOWED_AGENT_FIELDS,
  CURSOR_INJECTED_ROUTER,
  assertCursorCapabilityInventory,
} from "./contract.ts";
import type {
  CursorSource,
  SourceAgent,
  SourceCommand,
  SourceHookEntry,
  SourceSkill,
  VirtualFile,
} from "./types.ts";

export const CURSOR_ALLOWED_SKILL_FIELDS = new Set(["name", "description", "license"]);
export const CURSOR_ALLOWED_COMMAND_FIELDS = new Set([
  "name",
  "description",
  "argument-hint",
  "argument",
  "disable-model-invocation",
  "allowed-tools",
]);

const RESOURCE_DIRECTORIES = new Set(["skills", "references", "scripts", "assets"]);
const RUNTIME_FILES = [
  "hooks/posttool-bash-hints.py",
  "hooks/project_detect.py",
  "hooks/swift-guardrails.py",
];

function assertSafeRelativePath(relativePath: string): void {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`unsafe source path: ${relativePath}`);
  }
}

function readRegularFile(filename: string, executableForbidden = false): string {
  const stat = fs.lstatSync(filename);
  if (stat.isSymbolicLink()) throw new Error(`symlinked canonical input: ${filename}`);
  if (!stat.isFile()) throw new Error(`canonical input is not a regular file: ${filename}`);
  if (executableForbidden && (stat.mode & 0o111) !== 0) {
    throw new Error(`executable router resource: ${filename}`);
  }
  return fs.readFileSync(filename, "utf8");
}

function sortedDirectoryEntries(directory: string): fs.Dirent[] {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`symlinked canonical input: ${directory}`);
  if (!stat.isDirectory()) throw new Error(`canonical input is not a directory: ${directory}`);
  return fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareCursorPaths(left.name, right.name));
}

function collectResources(pluginRoot: string, skillDirectory: string): {
  resources: VirtualFile[];
  excludedMirrors: number;
} {
  const resources: VirtualFile[] = [];
  let excludedMirrors = 0;
  const collect = (directory: string): void => {
    for (const entry of sortedDirectoryEntries(directory)) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`symlinked canonical input: ${filename}`);
      if (entry.isDirectory()) {
        collect(filename);
      } else if (entry.isFile()) {
        const content = readRegularFile(filename, true);
        if (isGeneratedSubSkill(content)) {
          excludedMirrors++;
          continue;
        }
        const relative = path.relative(pluginRoot, filename).split(path.sep).join("/");
        assertSafeRelativePath(relative);
        resources.push({ path: relative, content, mode: 0o644 });
      } else {
        throw new Error(`unsupported router resource: ${filename}`);
      }
    }
  };

  for (const entry of sortedDirectoryEntries(skillDirectory)) {
    if (!RESOURCE_DIRECTORIES.has(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error(`symlinked canonical input: ${path.join(skillDirectory, entry.name)}`);
    if (!entry.isDirectory()) throw new Error(`router resource root is not a directory: ${entry.name}`);
    collect(path.join(skillDirectory, entry.name));
  }
  return { resources: resources.sort((left, right) => compareCursorPaths(left.path, right.path)), excludedMirrors };
}

function parseMarkdown(filename: string, allowedFields: ReadonlySet<string>): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const parsed = matter(readRegularFile(filename));
  const frontmatter = parsed.data as Record<string, unknown>;
  for (const field of Object.keys(frontmatter)) {
    if (!allowedFields.has(field)) {
      throw new Error(`unknown frontmatter field in ${path.basename(filename)}: ${field}`);
    }
  }
  return { frontmatter, body: parsed.content };
}

function loadSkills(pluginRoot: string): { skills: SourceSkill[]; excludedMirrors: number } {
  const skillsRoot = path.join(pluginRoot, "skills");
  let excludedMirrors = 0;
  const skills = sortedDirectoryEntries(skillsRoot).map((entry) => {
    const skillDirectory = path.join(skillsRoot, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symlinked canonical input: ${skillDirectory}`);
    if (!entry.isDirectory()) throw new Error(`skill is not a directory: ${entry.name}`);
    const filename = path.join(skillDirectory, "SKILL.md");
    const { frontmatter, body } = parseMarkdown(filename, CURSOR_ALLOWED_SKILL_FIELDS);
    if (frontmatter.name !== entry.name) {
      throw new Error(`skill frontmatter name must match directory: ${entry.name}`);
    }
    const resources = collectResources(pluginRoot, skillDirectory);
    excludedMirrors += resources.excludedMirrors;
    return {
      name: entry.name,
      relativeDir: `skills/${entry.name}`,
      frontmatter,
      body,
      resources: resources.resources,
    };
  });
  return { skills, excludedMirrors };
}

function loadAgents(pluginRoot: string): SourceAgent[] {
  const agentsRoot = path.join(pluginRoot, "agents");
  return sortedDirectoryEntries(agentsRoot)
    .filter((entry) => entry.name.endsWith(".md"))
    .map((entry) => {
      const filename = path.join(agentsRoot, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`symlinked canonical input: ${filename}`);
      if (!entry.isFile()) throw new Error(`agent is not a regular file: ${entry.name}`);
      const { frontmatter, body } = parseMarkdown(filename, CURSOR_ALLOWED_AGENT_FIELDS);
      const name = path.basename(entry.name, ".md");
      if (frontmatter.name !== name) throw new Error(`agent frontmatter name must match filename: ${entry.name}`);
      const parsedTools = parseAgentTools(readRegularFile(filename));
      if (parsedTools.kind !== "ok") throw new Error(`unparseable agent tools: ${entry.name}`);
      return { name, filename: entry.name, frontmatter, body, tools: parsedTools.tools };
    });
}

function loadCommands(pluginRoot: string, manifestCommands: unknown): SourceCommand[] {
  if (!Array.isArray(manifestCommands)) throw new Error("manifest commands must be an array");
  const commandsRoot = path.join(pluginRoot, "commands");
  const commandFiles = manifestCommands.map((entry) => {
    if (typeof entry !== "string") throw new Error("manifest command must be a string");
    const relative = entry.replace(/^\.\//, "");
    assertSafeRelativePath(relative);
    if (!relative.startsWith("commands/") || path.posix.dirname(relative) !== "commands") {
      throw new Error(`invalid manifest command path: ${entry}`);
    }
    return path.posix.basename(relative);
  }).sort();
  if (new Set(commandFiles).size !== commandFiles.length) throw new Error("duplicate manifest command file");
  if (commandFiles.length === 0) throw new Error("manifest declares no commands");
  return commandFiles.map((filename) => {
    const sourcePath = path.join(commandsRoot, filename);
    const { frontmatter, body } = parseMarkdown(sourcePath, CURSOR_ALLOWED_COMMAND_FIELDS);
    const stem = path.basename(filename, ".md");
    // transformCommand emits the file as `axiom-<stem>.md` but the frontmatter name as
    // `axiom-<name>`, so a divergence ships a command whose filename and name disagree.
    // Skills and agents already assert this; commands did not.
    if (typeof frontmatter.name === "string" && frontmatter.name !== stem) {
      throw new Error(`command frontmatter name must match filename: ${filename} declares ${frontmatter.name}`);
    }
    return { name: stem, filename, frontmatter, body };
  });
}

function loadHooks(pluginRoot: string, agents: SourceAgent[]): SourceHookEntry[] {
  const hooksPath = path.join(pluginRoot, "hooks", "hooks.json");
  const hooksDocument = JSON.parse(readRegularFile(hooksPath)) as {
    hooks?: Record<string, Array<{ matcher?: unknown; hooks?: Array<{ command?: unknown }> }>>;
  };
  if (!hooksDocument.hooks || typeof hooksDocument.hooks !== "object") throw new Error("invalid hooks document");
  const entries: SourceHookEntry[] = [];
  for (const event of Object.keys(hooksDocument.hooks).sort()) {
    for (const entry of hooksDocument.hooks[event] ?? []) {
      const matcher = entry.matcher === undefined ? null : entry.matcher;
      if (matcher !== null && typeof matcher !== "string") throw new Error(`invalid hook matcher: ${event}`);
      for (const hook of entry.hooks ?? []) {
        if (typeof hook.command !== "string") throw new Error(`invalid hook command: ${event}`);
        entries.push({ event, matcher, command: hook.command, source: "global", owner: null });
      }
    }
  }
  for (const agent of agents) {
    const hooks = agent.frontmatter.hooks;
    if (hooks === undefined) continue;
    if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) throw new Error(`invalid agent hooks: ${agent.name}`);
    for (const event of Object.keys(hooks as Record<string, unknown>).sort()) {
      const hookEntries = (hooks as Record<string, unknown>)[event];
      if (!Array.isArray(hookEntries)) throw new Error(`invalid agent hook entries: ${agent.name}`);
      for (const entry of hookEntries) {
        if (!entry || typeof entry !== "object") throw new Error(`invalid agent hook: ${agent.name}`);
        const matcher = (entry as { matcher?: unknown }).matcher;
        if (matcher !== undefined && typeof matcher !== "string") throw new Error(`invalid agent hook matcher: ${agent.name}`);
        const hooksList = (entry as { hooks?: unknown }).hooks;
        if (!Array.isArray(hooksList)) throw new Error(`invalid agent hook commands: ${agent.name}`);
        for (const hook of hooksList) {
          const command = (hook as { command?: unknown }).command;
          if (typeof command !== "string") throw new Error(`invalid agent hook command: ${agent.name}`);
          entries.push({ event, matcher: matcher ?? null, command, source: "agent", owner: agent.name });
        }
      }
    }
  }
  return entries;
}

function assertSkillInventory(skills: SourceSkill[], manifestSkills: unknown): string[] {
  if (!Array.isArray(manifestSkills)) throw new Error("manifest skills must be an array");
  const manifestNames = manifestSkills.map((entry) => {
    const name = (entry as { name?: unknown })?.name;
    if (typeof name !== "string") throw new Error("manifest skill name must be a string");
    return name;
  }).sort();
  const filesystemNames = skills.map((skill) => skill.name).sort();
  const difference = filesystemNames.filter((name) => !manifestNames.includes(name));
  const missing = manifestNames.filter((name) => !filesystemNames.includes(name));
  if (difference.join("\0") !== CURSOR_INJECTED_ROUTER || missing.length > 0) {
    throw new Error("filesystem and manifest skill inventories differ");
  }
  return manifestNames;
}

export function loadCursorSource(root: string): CursorSource {
  const pluginRoot = path.join(root, ".claude-plugin", "plugins", "axiom");
  const manifest = JSON.parse(readRegularFile(path.join(pluginRoot, "claude-code.json"))) as Record<string, unknown>;
  for (const field of ["version", "description", "author", "license"] as const) {
    if (typeof manifest[field] !== "string") throw new Error(`manifest ${field} must be a string`);
  }
  const loadedSkills = loadSkills(pluginRoot);
  const skills = loadedSkills.skills;
  const agents = loadAgents(pluginRoot);
  const manifestSkillNames = assertSkillInventory(skills, manifest.skills);
  const commands = loadCommands(pluginRoot, manifest.commands);
  assertCursorCapabilityInventory({
    routers: skills.map((skill) => skill.name),
    agents: agents.map((agent) => agent.name),
    commands: commands.map((command) => command.name),
  });
  const runtimeFiles = RUNTIME_FILES.map((relative) => ({
    path: relative,
    content: readRegularFile(path.join(pluginRoot, relative)),
    mode: 0o644 as const,
  }));
  return {
    version: manifest.version as string,
    description: manifest.description as string,
    author: manifest.author as string,
    license: manifest.license as string,
    manifestSkillNames,
    skills,
    excludedMirrors: loadedSkills.excludedMirrors,
    agents,
    commands,
    hooks: loadHooks(pluginRoot, agents),
    logo: typeof manifest.logo === "string" ? manifest.logo : "",
    runtimeFiles,
  };
}
