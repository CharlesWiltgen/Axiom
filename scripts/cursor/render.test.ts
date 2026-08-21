import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { renderCursorDistribution, writeCursorDistribution } from "./render.ts";

const root = process.cwd();
const marketplacePath = ".cursor-plugin/marketplace.json";

function filesByPath(distribution: ReturnType<typeof renderCursorDistribution>) {
  return new Map(distribution.plugin);
}

function listFiles(directory: string, prefix = ""): string[] {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(directory, entry.name);
      assert.equal(fs.lstatSync(absolute).isSymbolicLink(), false, `symlink: ${relative}`);
      return entry.isDirectory() ? listFiles(absolute, relative) : [relative];
    })
    .sort();
}

function snapshotTree(directory: string): Map<string, Buffer> {
  return new Map(listFiles(directory).map((file) => [file, fs.readFileSync(path.join(directory, file))]));
}

test("renders a separate nested Cursor marketplace and complete plugin tree", () => {
  const distribution = renderCursorDistribution(root, { profile: "full" });
  const marketplace = JSON.parse(distribution.marketplace.content);
  const files = filesByPath(distribution);

  assert.equal(distribution.marketplace.path, marketplacePath);
  assert.deepEqual(marketplace, {
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
  });
  assert.equal([...files.keys()].some((file) => file.startsWith("../")), false);

  const plugin = JSON.parse(files.get(".cursor-plugin/plugin.json")!.content);
  assert.equal(plugin.name, "axiom");
  assert.equal(plugin.displayName, "Axiom");
  assert.match(plugin.description, /Cursor/);
  assert.doesNotMatch(plugin.description, /Claude Code/);
  assert.equal(plugin.logo, "assets/logo.svg");
  assert.equal("mcpServers" in plugin, false);
  assert.ok(files.has("mcp.json"));
  assert.ok(files.has("hooks/hooks.json"));
  assert.ok(files.has("README.md"));
  assert.ok(files.has("assets/logo.svg"));
  assert.ok(files.has("reports/capability-disposition.json"));
  assert.ok(files.has("reports/inventory-sha256.json"));
  assert.equal([...files.keys()].filter((file) => file.startsWith("skills/") && file.endsWith("/SKILL.md")).length, 27);
  assert.equal([...files.keys()].filter((file) => file.startsWith("agents/") && file.endsWith(".md")).length, 42);
  assert.equal([...files.keys()].filter((file) => file.startsWith("commands/") && file.endsWith(".md")).length, 17);
});

test("generated README installs a local checkout through Cursor's marketplace flow", () => {
  const distribution = renderCursorDistribution(root, { profile: "full" });
  const readme = distribution.plugin.get("README.md")!.content;

  assert.match(readme, /Add.*From Local Repo/);
  assert.match(readme, /select the Axiom repository root/i);
  assert.match(readme, /Axiom Cursor Marketplace/);
  assert.doesNotMatch(readme, /\.cursor\/plugins\/local|ln -s|readlink/);
});

test("renders deterministic, safe, non-Claude Cursor bytes", () => {
  const first = renderCursorDistribution(root, { profile: "full" });
  const second = renderCursorDistribution(root, { profile: "full" });
  assert.deepEqual(first, second);

  for (const file of [first.marketplace, ...first.plugin.values()]) {
    assert.equal(file.mode, 0o644, file.path);
    assert.equal(path.posix.isAbsolute(file.path), false, file.path);
    assert.equal(file.path.split("/").includes(".."), false, file.path);
    assert.doesNotMatch(file.content, /CLAUDE_PLUGIN_ROOT|\$ARGUMENTS|\{\{args\.|\/axiom:|TaskOutput|AskUserQuestion/);
    if (/^(?:agents|commands)\//.test(file.path)) {
      assert.doesNotMatch(
        file.content,
        /\bsubagent_type\b|\brun_in_background\b|\bAgent call\b|delegated subagent result tool|\bLaunch(?:es)? (?:the )?[^\n]* agent\b/i,
      );
    }
    assert.doesNotMatch(file.content, /\b(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)\b\s*[:=]\s*["']?(?:sk-|ghp_|AKIA)[A-Za-z0-9_=-]+/i);
  }
  assert.equal([...first.plugin.keys()].some((file) => /generated.*mirror|mirror.*generated/i.test(file)), false);
});

test("orders inventory paths by locale-independent code points", () => {
  const distribution = renderCursorDistribution(root, { profile: "full" });
  const inventory = JSON.parse(distribution.plugin.get("reports/inventory-sha256.json")!.content);
  const paths = inventory.files.map((file: { path: string }) => file.path);
  const expectedPaths = [...distribution.plugin.keys()]
    .filter((file) => file !== "reports/inventory-sha256.json")
    .sort();

  assert.deepEqual(paths, [...paths].sort());
  assert.deepEqual(paths, expectedPaths);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(inventory.totals, {
    files: expectedPaths.length,
    bytes: inventory.files.reduce((total: number, file: { bytes: number }) => total + file.bytes, 0),
  });
  assert.deepEqual(paths.slice(0, 3), [
    ".cursor-plugin/plugin.json",
    "README.md",
    "agents/accessibility-auditor.md",
  ]);
});

test("rejects noncanonical virtual paths and mismatched map keys", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-paths-"));
  const distribution = {
    marketplace: { path: marketplacePath, content: "{}\n", mode: 0o644 as const },
    plugin: new Map<string, { path: string; content: string; mode: 0o644 }>(),
  };
  try {
    for (const virtualPath of ["a//b", "a/./b", "a\\b", "a\0b"]) {
      distribution.plugin = new Map([[virtualPath, { path: virtualPath, content: "safe\n", mode: 0o644 }]]);
      assert.throws(
        () => writeCursorDistribution(destination, distribution),
        /unsafe virtual path/,
        virtualPath,
      );
    }

    distribution.plugin = new Map([["alias.md", { path: "actual.md", content: "safe\n", mode: 0o644 }]]);
    assert.throws(
      () => writeCursorDistribution(destination, distribution),
      /virtual map key does not match file path/,
    );
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("fails the production render boundary on an unresolved emitted reference", () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-broken-reference-"));
  const relativePluginRoot = path.join(".claude-plugin", "plugins", "axiom");
  try {
    fs.mkdirSync(path.join(sourceRoot, ".claude-plugin", "plugins"), { recursive: true });
    fs.cpSync(path.join(root, relativePluginRoot), path.join(sourceRoot, relativePluginRoot), { recursive: true });
    const router = path.join(sourceRoot, relativePluginRoot, "skills", "axiom-tools", "SKILL.md");
    fs.appendFileSync(router, "\n[Missing generated resource](skills/definitely-missing.md)\n");

    assert.throws(
      () => renderCursorDistribution(sourceRoot, { profile: "full" }),
      /unresolved local reference from skills\/axiom-tools\/SKILL\.md: skills\/definitely-missing\.md/,
    );
  } finally {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test("transactionally replaces both Cursor roots without paths outside the destination", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-render-"));
  try {
    const distribution = renderCursorDistribution(root, { profile: "full" });
    writeCursorDistribution(destination, distribution);
    assert.deepEqual(listFiles(path.join(destination, ".cursor-plugin")), ["marketplace.json"]);
    assert.ok(fs.existsSync(path.join(destination, "axiom-cursor", ".cursor-plugin", "plugin.json")));
    assert.ok(fs.existsSync(path.join(destination, "axiom-cursor", "mcp.json")));
    for (const file of listFiles(path.join(destination, "axiom-cursor"))) {
      assert.equal(fs.statSync(path.join(destination, "axiom-cursor", file)).mode & 0o777, 0o644, file);
    }
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("an active destination writer lock prevents a second writer from touching either root", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-lock-"));
  const pluginRoot = path.join(destination, "axiom-cursor");
  const marketplaceRoot = path.join(destination, ".cursor-plugin");
  const marketplace = path.join(marketplaceRoot, "marketplace.json");
  const lock = path.join(destination, ".cursor-distribution.lock");
  try {
    fs.mkdirSync(pluginRoot);
    fs.mkdirSync(marketplaceRoot);
    fs.writeFileSync(path.join(pluginRoot, "old.txt"), "old plugin bytes\n");
    fs.writeFileSync(marketplace, "old marketplace bytes\n");
    const oldPlugin = snapshotTree(pluginRoot);
    const oldMarketplace = fs.readFileSync(marketplace);
    fs.mkdirSync(lock);
    fs.writeFileSync(path.join(lock, "owner"), "writer-one\n");

    const distribution = {
      marketplace: { path: marketplacePath, content: "new marketplace bytes\n", mode: 0o644 as const },
      plugin: new Map([["new.txt", { path: "new.txt", content: "new plugin bytes\n", mode: 0o644 as const }]]),
    };
    assert.throws(
      () => writeCursorDistribution(destination, distribution),
      /Cursor distribution writer lock is already held/,
    );
    assert.deepEqual(snapshotTree(pluginRoot), oldPlugin);
    assert.deepEqual(fs.readFileSync(marketplace), oldMarketplace);
    assert.deepEqual(fs.readFileSync(path.join(lock, "owner"), "utf8"), "writer-one\n");
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("cleans transaction setup when the marketplace parent is a regular file", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-setup-failure-"));
  const pluginRoot = path.join(destination, "axiom-cursor");
  const marketplaceBlocker = path.join(destination, ".cursor-plugin");
  try {
    fs.mkdirSync(path.join(pluginRoot, "nested"), { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, "nested", "old.txt"), "old plugin bytes\n");
    fs.writeFileSync(marketplaceBlocker, "old marketplace blocker bytes\n");
    const oldPlugin = snapshotTree(pluginRoot);
    const oldMarketplaceBlocker = fs.readFileSync(marketplaceBlocker);
    const oldDestinationEntries = fs.readdirSync(destination).sort();
    const distribution = {
      marketplace: { path: marketplacePath, content: "new marketplace bytes\n", mode: 0o644 as const },
      plugin: new Map([["new.txt", { path: "new.txt", content: "new plugin bytes\n", mode: 0o644 as const }]]),
    };
    let failure: unknown;

    try {
      writeCursorDistribution(destination, distribution);
    } catch (error) {
      failure = error;
    }

    assert.ok(failure instanceof Error, "expected transaction setup to fail");
    assert.deepEqual(snapshotTree(pluginRoot), oldPlugin);
    assert.deepEqual(fs.readFileSync(marketplaceBlocker), oldMarketplaceBlocker);
    assert.deepEqual(
      fs.readdirSync(destination).filter((entry) => entry.includes("staging") || entry.includes("backup") || entry.includes("transaction")),
      [],
    );
    assert.deepEqual(fs.readdirSync(destination).sort(), oldDestinationEntries);
    assert.match(failure.message, /marketplace output directory is not a directory/);
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("leaves an invocation-created marketplace parent after promotion rollback", (context) => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-parent-retention-"));
  const pluginRoot = path.join(destination, "axiom-cursor");
  const marketplaceRoot = path.join(destination, ".cursor-plugin");
  const marketplace = path.join(marketplaceRoot, "marketplace.json");
  try {
    fs.mkdirSync(path.join(pluginRoot, "nested"), { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, "nested", "old.txt"), "old plugin bytes\n");
    const oldPlugin = snapshotTree(pluginRoot);
    const distribution = {
      marketplace: { path: marketplacePath, content: "new marketplace bytes\n", mode: 0o644 as const },
      plugin: new Map([["new.txt", { path: "new.txt", content: "new plugin bytes\n", mode: 0o644 as const }]]),
    };
    const renameSync = fs.renameSync.bind(fs);
    let failedPromotion = false;
    context.mock.method(fs, "renameSync", (source: fs.PathLike, target: fs.PathLike) => {
      if (!failedPromotion && path.resolve(String(target)) === marketplace) {
        failedPromotion = true;
        throw new Error("forced marketplace promotion failure");
      }
      return renameSync(source, target);
    });

    assert.throws(
      () => writeCursorDistribution(destination, distribution),
      /forced marketplace promotion failure/,
    );
    assert.deepEqual(snapshotTree(pluginRoot), oldPlugin);
    assert.equal(fs.existsSync(marketplaceRoot), true);
    assert.deepEqual(fs.readdirSync(marketplaceRoot), []);
    assert.deepEqual(
      fs.readdirSync(destination).filter((entry) => entry.includes("staging") || entry.includes("backup") || entry.includes("transaction")),
      [],
    );
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("cleans transaction residue after post-create staging failure", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-staging-failure-"));
  const pluginRoot = path.join(destination, "axiom-cursor");
  const marketplaceRoot = path.join(destination, ".cursor-plugin");
  try {
    fs.mkdirSync(path.join(pluginRoot, "nested"), { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, "nested", "old.txt"), "old plugin bytes\n");
    const oldPlugin = snapshotTree(pluginRoot);
    const distribution = {
      marketplace: { path: marketplacePath, content: "new marketplace bytes\n", mode: 0o644 as const },
      plugin: new Map([
        ["conflict", { path: "conflict", content: "blocking file\n", mode: 0o644 as const }],
        ["conflict/child.txt", { path: "conflict/child.txt", content: "unwritable child\n", mode: 0o644 as const }],
      ]),
    };
    let failure: unknown;

    try {
      writeCursorDistribution(destination, distribution);
    } catch (error) {
      failure = error;
    }

    assert.ok(failure instanceof Error, "expected staging to fail after marketplace parent creation");
    assert.deepEqual(snapshotTree(pluginRoot), oldPlugin);
    assert.equal(fs.existsSync(marketplaceRoot), true);
    assert.deepEqual(fs.readdirSync(marketplaceRoot), []);
    assert.deepEqual(fs.readdirSync(destination).sort(), [".cursor-plugin", "axiom-cursor"]);
    assert.deepEqual(
      fs.readdirSync(destination).filter((entry) => entry.includes("staging") || entry.includes("backup") || entry.includes("transaction")),
      [],
    );
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("rolls back both generated roots when marketplace promotion fails", (context) => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-rollback-"));
  const pluginRoot = path.join(destination, "axiom-cursor");
  const marketplaceRoot = path.join(destination, ".cursor-plugin");
  const marketplace = path.join(marketplaceRoot, "marketplace.json");
  try {
    fs.mkdirSync(path.join(pluginRoot, "nested"), { recursive: true });
    fs.mkdirSync(marketplaceRoot, { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, "nested", "old.txt"), "old plugin bytes\n");
    fs.writeFileSync(marketplace, "old marketplace bytes\n");
    const oldPlugin = snapshotTree(pluginRoot);
    const oldMarketplace = fs.readFileSync(marketplace);
    const distribution = {
      marketplace: { path: marketplacePath, content: "new marketplace bytes\n", mode: 0o644 as const },
      plugin: new Map([["new.txt", { path: "new.txt", content: "new plugin bytes\n", mode: 0o644 as const }]]),
    };
    const renameSync = fs.renameSync.bind(fs);
    let failedPromotion = false;
    context.mock.method(fs, "renameSync", (source: fs.PathLike, target: fs.PathLike) => {
      if (!failedPromotion && path.resolve(String(target)) === marketplace) {
        failedPromotion = true;
        throw new Error("forced marketplace promotion failure");
      }
      return renameSync(source, target);
    });

    assert.throws(
      () => writeCursorDistribution(destination, distribution),
      /forced marketplace promotion failure/,
    );
    assert.deepEqual(snapshotTree(pluginRoot), oldPlugin);
    assert.deepEqual(fs.readFileSync(marketplace), oldMarketplace);
    assert.deepEqual(
      fs.readdirSync(destination).filter((entry) => entry.includes("staging") || entry.includes("backup") || entry.includes("transaction")),
      [],
    );
    assert.deepEqual(
      fs.readdirSync(marketplaceRoot).filter((entry) => entry.includes("staging") || entry.includes("backup") || entry.includes("transaction") || entry.includes("tmp")),
      [],
    );
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});
