import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { compareCursorPaths } from "./compare.ts";
import { transformAgent } from "./agents.ts";
import { transformCommand } from "./commands.ts";
import { renderCursorHooks } from "./hooks.ts";
import { renderCursorMcp, validateMcpVariables } from "./mcp.ts";
import { buildCapabilityReport } from "./report.ts";
import {
  assertHostClaimRewritesFired,
  resetHostClaimRewriteTracking,
  validateCursorReferences,
} from "./references.ts";
import { transformSkill } from "./skills.ts";
import { loadCursorSource } from "./source.ts";
import type { AgentProfile, CapabilityReport, VirtualFile } from "./types.ts";

export interface CursorDistribution {
  marketplace: VirtualFile;
  plugin: ReadonlyMap<string, VirtualFile>;
}

const MARKETPLACE_PATH = ".cursor-plugin/marketplace.json";
const PLUGIN_MANIFEST_PATH = ".cursor-plugin/plugin.json";
const WRITER_LOCK = ".cursor-distribution.lock";
const GENERATED_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-labelledby="title"><title>Axiom</title><rect width="128" height="128" rx="28" fill="#3451b2"/><path fill="#fff" d="M64 20 112 108H91l-9-18H46l-9 18H16L64 20Zm0 34-10 21h20L64 54Z"/></svg>\n`;

function json(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function assertVirtualPath(file: VirtualFile): void {
  const normalized = path.posix.normalize(file.path);
  if (
    !file.path
    || file.path.includes("\0")
    || file.path.includes("\\")
    || file.path.endsWith("/")
    || path.posix.isAbsolute(file.path)
    || normalized !== file.path
  ) {
    throw new Error(`unsafe virtual path: ${file.path}`);
  }
  if (file.mode !== 0o644) throw new Error(`unsafe virtual mode: ${file.path}`);
  if (file.content.includes("\0")) throw new Error(`binary virtual file: ${file.path}`);
  const staleHarnessToken = /CLAUDE_PLUGIN_ROOT|\$ARGUMENTS|\{\{args\.|\/axiom:|TaskOutput|AskUserQuestion/.test(file.content);
  const staleDelegationToken = /^(?:agents|commands)\//.test(file.path)
    && /\bsubagent_type\b|\brun_in_background\b|\bAgent call\b|delegated subagent result tool|\bLaunch(?:es)? (?:the )?[^\n]* agent\b/i.test(file.content);
  if (staleHarnessToken || staleDelegationToken) {
    throw new Error(`stale Claude token in virtual file: ${file.path}`);
  }
}

function addFile(files: Map<string, VirtualFile>, file: VirtualFile): void {
  assertVirtualPath(file);
  if (files.has(file.path)) throw new Error(`duplicate virtual path: ${file.path}`);
  files.set(file.path, Object.freeze({ ...file, mode: 0o644 }));
}

function generatedReadme(report: CapabilityReport, version: string): string {
  return [
    "# Axiom for Cursor",
    "",
    `A native Cursor plugin for modern Apple platform development, generated from Axiom ${version}.`,
    "",
    "## Included",
    "",
    `- ${report.routers} skill routers`,
    `- ${report.agents} agents`,
    `- ${report.commands} \`/axiom-*\` commands`,
    "- Advisory session, shell, and post-write hooks",
    "- Automatic plugin-root MCP discovery",
    `- ${report.excludedMirrors} generated mirrors intentionally excluded`,
    "",
    "## Requirements and Support",
    "",
    "The supported target is Cursor IDE/Desktop on macOS. Node.js 18 or newer is required for the MCP server, and Python 3 is required for the advisory hook adapters. This plugin makes no Cursor Cloud support claim.",
    "",
    "The generated plugin tree contains source and static assets but no compiled or executable binary payloads. Its root `mcp.json` launches the separately distributed `axiom-mcp` npm package with `npx -y axiom-mcp`; first use may require network access, package resolution, and Cursor approval.",
    "",
    "## Install a Local Checkout",
    "",
    "Clone Axiom to a stable absolute path and check out the revision you intend to test.",
    "",
    "1. Open Cursor's Customize panel and choose **Add → From Local Repo**.",
    "2. Select the Axiom repository root—the directory containing `.cursor-plugin/marketplace.json`—and choose **Add Plugins**.",
    "3. Under **Axiom Cursor Marketplace**, choose **Add** for Axiom.",
    "",
    "Cursor imports the local marketplace into its plugin cache; it does not follow later checkout changes automatically. After changing revisions or regenerating `axiom-cursor/`, uninstall Axiom, remove **Axiom Cursor Marketplace**, and repeat the local-repository flow before testing.",
    "",
    `Open Cursor's Customize panel and verify Axiom's version plus all ${report.routers} skills, ${report.agents} agents, ${report.commands} commands, hooks, and MCP server before relying on the installation.`,
    "",
    "## Authority and Hooks",
    "",
    `The released profile has ${report.releasedReadonlyBackground} read-only/background agents and ${report.releasedWritableForeground} writable/foreground agents. Cursor agents inherit host tool and MCP access that may be broader than their canonical Axiom tool lists. Review the agent, tool approvals, and MCP allowlist before running it; prompt instructions and hooks are not security boundaries. Writable agents run in the foreground and may change the shared checkout.`,
    "",
    "Hooks add routing or diagnostic context after supported events. They are advisory, fail open, and do not enforce permissions or undo an edit that already happened.",
    "",
    "## Troubleshooting and Support",
    "",
    "If components are missing, confirm you selected the Axiom repository root, `.cursor-plugin/marketplace.json` points to `./axiom-cursor`, and the installed local marketplace was refreshed after the checkout changed. If hooks are absent, confirm `python3` is available. If MCP fails, confirm Node.js 18+ and review Cursor's MCP approval, allowlist/blocklist, and network state. Do not add a duplicate `.cursor/mcp.json` entry when using the plugin.",
    "",
    "See the [Cursor install and support guide](https://charleswiltgen.github.io/Axiom/start/cursor-install) or [open an upstream Axiom issue](https://github.com/CharlesWiltgen/Axiom/issues) with sanitized diagnostics. Cursor Marketplace acceptance, non-macOS behavior, Cloud Agents, npm availability, Xcode/toolchain failures, and third-party MCP policy are outside the documented Axiom plugin support boundary.",
    "",
    "This directory is generated. Edit the canonical Axiom source or `scripts/cursor/render.ts`, then run `npm run build:cursor`; do not edit generated files directly.",
    "",
  ].join("\n");
}

function cursorRuntime(file: VirtualFile): VirtualFile {
  return {
    ...file,
    content: file.content
      .replaceAll("CLAUDE_TOOL_OUTPUT", "CURSOR_TOOL_OUTPUT")
      .replaceAll("/axiom:", "/axiom-"),
    mode: 0o644,
  };
}

function inventoryReport(files: ReadonlyMap<string, VirtualFile>, report: CapabilityReport): VirtualFile {
  const entries = [...files.values()]
    .filter((file) => file.path !== "reports/inventory-sha256.json")
    .sort((left, right) => compareCursorPaths(left.path, right.path))
    .map((file) => ({
      path: file.path,
      sha256: crypto.createHash("sha256").update(file.content, "utf8").digest("hex"),
      bytes: Buffer.byteLength(file.content, "utf8"),
    }));
  return {
    path: "reports/inventory-sha256.json",
    content: json({
      profile: "full",
      files: entries,
      totals: { files: entries.length, bytes: entries.reduce((total, entry) => total + entry.bytes, 0) },
      excludedMirrors: report.excludedMirrors,
      classes: {
        routers: report.routers,
        agents: report.agents,
        commands: report.commands,
        releasedReadonlyBackground: report.releasedReadonlyBackground,
        releasedWritableForeground: report.releasedWritableForeground,
      },
      authorityExpansions: report.authorityExpansions,
    }),
    mode: 0o644,
  };
}

/** Produce both repository-level marketplace data and the nested plugin tree. */
export function renderCursorDistribution(sourceRoot: string, options: { profile: AgentProfile }): CursorDistribution {
  if (options.profile !== "full") throw new Error(`unsupported Cursor profile: ${options.profile}`);
  resetHostClaimRewriteTracking();
  const source = loadCursorSource(sourceRoot);
  const agents = source.agents.map((agent) => transformAgent(agent, options.profile));
  const report = buildCapabilityReport(source, agents);
  const files = new Map<string, VirtualFile>();
  const pluginManifest = {
    name: "axiom",
    version: source.version,
    description: "Battle-tested Cursor skills, agents, commands, hooks, and MCP for modern Apple platform development.",
    author: { name: source.author, url: "https://charleswiltgen.github.io/Axiom/" },
    homepage: "https://charleswiltgen.github.io/Axiom/",
    repository: "https://github.com/CharlesWiltgen/Axiom",
    license: source.license,
    displayName: "Axiom",
    keywords: ["ios", "swift", "swiftui", "xcode", "apple", "mobile", "development"],
    logo: "assets/logo.svg",
  };
  validateMcpVariables(pluginManifest, JSON.parse(renderCursorMcp().content));
  addFile(files, { path: PLUGIN_MANIFEST_PATH, content: json(pluginManifest), mode: 0o644 });
  addFile(files, { path: "README.md", content: generatedReadme(report, source.version), mode: 0o644 });
  addFile(files, { path: "assets/logo.svg", content: GENERATED_LOGO, mode: 0o644 });
  for (const skill of source.skills) for (const file of transformSkill(skill)) addFile(files, file);
  for (const agent of agents) addFile(files, agent.file);
  for (const command of source.commands) addFile(files, transformCommand(command));
  // Every host-claim rewrite must have matched real canonical prose; a dead pattern means
  // the canonical wording moved and Cursor output silently kept a Claude-only claim.
  assertHostClaimRewritesFired();
  for (const file of renderCursorHooks()) addFile(files, cursorRuntime(file));
  addFile(files, renderCursorMcp());
  addFile(files, {
    path: "reports/capability-disposition.json",
    content: json(report),
    mode: 0o644,
  });
  addFile(files, inventoryReport(files, report));
  validateCursorReferences(new Map(
    [...files].filter(([filePath]) => filePath.startsWith("skills/")),
  ));

  const marketplace: VirtualFile = Object.freeze({
    path: MARKETPLACE_PATH,
    content: json({
      name: "axiom-cursor-marketplace",
      owner: { name: "Charles Wiltgen", email: "charles@wiltgen.net" },
      metadata: {
        description: "Native Cursor plugin for Axiom Apple platform development skills, agents, commands, hooks, and MCP.",
      },
      plugins: [{
        name: "axiom",
        source: "./axiom-cursor",
        description: "Battle-tested skills, agents, commands, hooks, and MCP for modern Apple platform development.",
      }],
    }),
    mode: 0o644,
  });
  assertVirtualPath(marketplace);
  return Object.freeze({ marketplace, plugin: new Map([...files.entries()].sort(([a], [b]) => compareCursorPaths(a, b))) });
}

function assertDestination(directory: string): void {
  if (!path.isAbsolute(directory)) throw new Error(`destination must be absolute: ${directory}`);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`symlinked destination: ${directory}`);
  if (!stat.isDirectory()) throw new Error(`destination is not a directory: ${directory}`);
}

function writeTree(directory: string, files: Iterable<VirtualFile>): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  for (const file of files) {
    assertVirtualPath(file);
    const destination = path.join(directory, file.path);
    const relative = path.relative(directory, destination);
    if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`virtual file escapes output: ${file.path}`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o755 });
    fs.writeFileSync(destination, file.content, { encoding: "utf8", mode: 0o644 });
    fs.chmodSync(destination, 0o644);
  }
}

function writeFile(directory: string, file: VirtualFile): void {
  assertVirtualPath(file);
  fs.writeFileSync(directory, file.content, { encoding: "utf8", mode: 0o644 });
  fs.chmodSync(directory, 0o644);
}

function assertRemovableTransaction(transaction: string, destination: string): void {
  if (
    path.dirname(transaction) !== destination
    || !path.basename(transaction).startsWith(".cursor-distribution.transaction-")
    || fs.lstatSync(transaction).isSymbolicLink()
    || !fs.lstatSync(transaction).isDirectory()
  ) {
    throw new Error(`refusing to remove unvalidated Cursor transaction: ${transaction}`);
  }
}

interface DestinationLock {
  directory: string;
  owner: string;
}

function acquireDestinationLock(destination: string): DestinationLock {
  const directory = path.join(destination, WRITER_LOCK);
  const owner = `${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Cursor distribution writer lock is already held: ${directory}`);
    }
    throw error;
  }
  try {
    fs.writeFileSync(path.join(directory, "owner"), `${owner}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    fs.rmdirSync(directory);
    throw error;
  }
  return { directory, owner };
}

function assertLockOwnership(lock: DestinationLock): void {
  const stat = fs.lstatSync(lock.directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Cursor distribution writer lock changed ownership: ${lock.directory}`);
  }
  const owner = fs.readFileSync(path.join(lock.directory, "owner"), "utf8");
  if (owner !== `${lock.owner}\n`) {
    throw new Error(`Cursor distribution writer lock changed ownership: ${lock.directory}`);
  }
}

function releaseDestinationLock(lock: DestinationLock): void {
  assertLockOwnership(lock);
  fs.unlinkSync(path.join(lock.directory, "owner"));
  fs.rmdirSync(lock.directory);
}

function assertTransactionOwnership(transaction: string, destination: string, owner: string): void {
  assertRemovableTransaction(transaction, destination);
  if (fs.readFileSync(path.join(transaction, "owner"), "utf8") !== `${owner}\n`) {
    throw new Error(`Cursor distribution transaction changed ownership: ${transaction}`);
  }
}

/** Transactionally replace the two generated Cursor roots with post-exit consistency. */
export function writeCursorDistribution(destination: string, distribution: CursorDistribution): void {
  assertDestination(destination);
  const marketplace = distribution.marketplace;
  if (marketplace.path !== MARKETPLACE_PATH) throw new Error(`unexpected marketplace path: ${marketplace.path}`);
  for (const [key, file] of distribution.plugin) {
    if (key !== file.path) throw new Error(`virtual map key does not match file path: ${key} != ${file.path}`);
    assertVirtualPath(file);
  }

  const lock = acquireDestinationLock(destination);
  let operationError: unknown;
  try {
    const pluginTarget = path.join(destination, "axiom-cursor");
    const marketplaceTarget = path.join(destination, MARKETPLACE_PATH);
    const marketplaceParent = path.dirname(marketplaceTarget);
    const marketplaceParentExisted = fs.existsSync(marketplaceParent);
    if (marketplaceParentExisted) {
      const stat = fs.lstatSync(marketplaceParent);
      if (stat.isSymbolicLink()) throw new Error(`symlinked output directory: ${marketplaceParent}`);
      if (!stat.isDirectory()) throw new Error(`marketplace output directory is not a directory: ${marketplaceParent}`);
    }
    const transaction = fs.mkdtempSync(path.join(destination, ".cursor-distribution.transaction-"));
    try {
      fs.writeFileSync(path.join(transaction, "owner"), `${lock.owner}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch (error) {
      assertRemovableTransaction(transaction, destination);
      fs.rmSync(transaction, { recursive: true });
      throw error;
    }
    const pluginNext = path.join(transaction, "axiom-cursor.next");
    const pluginBackup = path.join(transaction, "axiom-cursor.backup");
    const marketplaceNext = path.join(transaction, "marketplace.json.next");
    const marketplaceBackup = path.join(transaction, "marketplace.json.backup");
    let pluginBackedUp = false;
    let marketplaceBackedUp = false;
    let pluginPromoted = false;
    let marketplacePromoted = false;
    let rollbackComplete = true;

    try {
      if (!marketplaceParentExisted) {
        fs.mkdirSync(marketplaceParent, { mode: 0o755 });
      }
      const marketplaceParentStat = fs.lstatSync(marketplaceParent);
      if (marketplaceParentStat.isSymbolicLink()) throw new Error(`symlinked output directory: ${marketplaceParent}`);
      if (!marketplaceParentStat.isDirectory()) throw new Error(`marketplace output directory is not a directory: ${marketplaceParent}`);

      writeTree(pluginNext, distribution.plugin.values());
      writeFile(marketplaceNext, marketplace);

      assertLockOwnership(lock);
      assertTransactionOwnership(transaction, destination, lock.owner);
      if (fs.existsSync(pluginTarget)) {
        const stat = fs.lstatSync(pluginTarget);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`unsafe plugin output root: ${pluginTarget}`);
        fs.renameSync(pluginTarget, pluginBackup);
        pluginBackedUp = true;
      }
      assertLockOwnership(lock);
      if (fs.existsSync(marketplaceTarget)) {
        const stat = fs.lstatSync(marketplaceTarget);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`unsafe marketplace output: ${marketplaceTarget}`);
        fs.renameSync(marketplaceTarget, marketplaceBackup);
        marketplaceBackedUp = true;
      }

      assertLockOwnership(lock);
      fs.renameSync(pluginNext, pluginTarget);
      pluginPromoted = true;
      assertLockOwnership(lock);
      fs.renameSync(marketplaceNext, marketplaceTarget);
      marketplacePromoted = true;
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      const rollback = (operation: () => void): void => {
        try {
          assertLockOwnership(lock);
          assertTransactionOwnership(transaction, destination, lock.owner);
          operation();
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      };
      if (marketplacePromoted && fs.existsSync(marketplaceTarget)) rollback(() => fs.unlinkSync(marketplaceTarget));
      if (marketplaceBackedUp && fs.existsSync(marketplaceBackup)) rollback(() => fs.renameSync(marketplaceBackup, marketplaceTarget));
      if (pluginPromoted && fs.existsSync(pluginTarget)) rollback(() => fs.rmSync(pluginTarget, { recursive: true }));
      if (pluginBackedUp && fs.existsSync(pluginBackup)) rollback(() => fs.renameSync(pluginBackup, pluginTarget));
      // Keep an empty fixed-name parent: deleting it is outside the transaction's ownership boundary.
      rollbackComplete = rollbackErrors.length === 0;
      if (!rollbackComplete) {
        throw new AggregateError([error, ...rollbackErrors], "Cursor distribution promotion and rollback failed");
      }
      throw error;
    } finally {
      if (rollbackComplete && fs.existsSync(transaction)) {
        assertTransactionOwnership(transaction, destination, lock.owner);
        fs.rmSync(transaction, { recursive: true });
      }
    }
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      releaseDestinationLock(lock);
    } catch (releaseError) {
      if (operationError) {
        throw new AggregateError([operationError, releaseError], "Cursor distribution write and lock release failed");
      }
      throw releaseError;
    }
  }
}
