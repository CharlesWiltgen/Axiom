/**
 * Pre-publish smoke test of the axiom-mcp npm package, run by `/preflight release`.
 *
 * `npm publish` cannot be undone, and the package ships native binaries, a license
 * and the `xcproject` CLI. Nothing exercised the packed artifact before release:
 * the previous candidate improvised this check from a scratch script (Axiom-r8wa.5). This builds
 * what `prepublishOnly` builds, packs it, installs the tarball into a disposable
 * prefix as `npx -y axiom-mcp` would, and checks the installed copy.
 *
 * Usage: node scripts/mcp-package-smoke.ts [--keep]
 * Prints one compact JSON report. Exit 1 on any problem; needs network for the
 * package's dependencies, so an offline run fails rather than passing.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { MCP_PACKAGED_BINARIES } from "../axiom-mcp/src/tools/binaries.ts";
import { npmInstallEnvironment } from "./npm-resolution.ts";

const sha256 = (file: string) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const mode = (file: string) => (fs.statSync(file).mode & 0o777).toString(8);

export function comparePackagedArtifacts(
  packageRoot: string,
  pluginDir: string,
  binaries: readonly string[] = MCP_PACKAGED_BINARIES,
): string[] {
  const problems: string[] = [];
  const pairs = [
    ...binaries.map((name) => [`dist/bin/${name}`, `bin/${name}`]),
    ["dist/licenses/xcproject.txt", "licenses/xcproject.txt"],
  ];
  for (const [shipped, canonical] of pairs) {
    const shippedPath = path.join(packageRoot, shipped);
    const canonicalPath = path.join(pluginDir, canonical);
    if (!fs.existsSync(shippedPath)) {
      problems.push(`${shipped} is missing from the package`);
      continue;
    }
    if (sha256(shippedPath) !== sha256(canonicalPath))
      problems.push(`${shipped} differs from canonical ${canonical}`);
    else if (mode(shippedPath) !== mode(canonicalPath))
      problems.push(
        `${shipped} mode ${mode(shippedPath)} differs from canonical ${canonical} mode ${mode(canonicalPath)}`,
      );
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (manifest.bin?.xcproject !== "./dist/bin/xcproject")
    problems.push("package.json bin.xcproject must be ./dist/bin/xcproject");
  return problems;
}

// Mirrors axiom-mcp/package.json `files`, plus the manifest npm always packs. A stray
// file here is how a credential (`.npmrc`, `fnox.toml`) would reach the registry.
export function unexpectedPackedFiles(files: readonly string[]): string[] {
  const allowed = new Set(["package.json", "README.md", "LICENSE"]);
  return files.filter((file) => !allowed.has(file) && !file.startsWith("dist/"));
}

const root = path.resolve(import.meta.dirname, "..");
const pluginDir = path.join(root, ".claude-plugin/plugins/axiom");
const mcpDir = path.join(root, "axiom-mcp");
// A stable skill to read back through the installed server; checked against the repo
// first, so a rename reports a stale smoke fixture rather than a package defect.
const SMOKE_SKILL = { name: "axiom-build--build-performance", file: "skills/axiom-build/skills/build-performance.md" };

function run(command: string, args: string[], cwd: string, timeout = 300_000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
    env: npmInstallEnvironment(process.env),
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} in ${cwd} failed (${result.error?.message ?? `exit ${result.status}`}): ${result.stderr?.slice(-400) ?? ""}`,
    );
  return result.stdout;
}

function inspectFixtures(xcproject: string, cwd: string, problems: string[]) {
  const rosetta = spawnSync("/usr/bin/arch", ["-x86_64", "/usr/bin/true"]).status === 0;
  const architectures = [process.arch === "arm64" ? "arm64" : "x86_64", ...(process.arch === "arm64" && rosetta ? ["x86_64"] : [])];
  const checked: string[] = [];
  for (const architecture of architectures) {
    for (const format of ["xcproj", "pbxproj"]) {
      const project = path.join(root, "scripts/fixtures/xcode-projects", format, "Example.xcodeproj");
      const file = path.join(project, `project.${format}`);
      const before = sha256(file);
      const result = spawnSync(
        "/usr/bin/arch",
        [`-${architecture}`, xcproject, "inspect", "--project", project, "--target", "Extension", "--configuration", "Release"],
        { cwd, encoding: "utf8", timeout: 10_000 },
      );
      const label = `xcproject inspect ${format} (${architecture})`;
      if (result.status !== 0) {
        problems.push(`${label} exited ${result.status ?? result.error?.message}: ${result.stderr?.slice(-200) ?? ""}`);
        continue;
      }
      let value;
      try {
        value = JSON.parse(result.stdout);
      } catch {
        problems.push(`${label} printed non-JSON output: ${result.stdout.slice(0, 200)}`);
        continue;
      }
      const actual = { format: value.format, targets: value.targets, configurations: value.configurations, selection: value.selection, semantics: value.semantics };
      const expected = { format, targets: ["Primary", "Extension", "Support"], configurations: ["Debug", "Release"], selection: { target: "Extension", configuration: "Release" }, semantics: "declarations" };
      if (!isDeepStrictEqual(actual, expected))
        problems.push(`${label} returned ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
      if (sha256(file) !== before) problems.push(`${label} modified the fixture project`);
      checked.push(`${architecture}/${format}`);
    }
  }
  return checked;
}

async function checkServer(install: string, pkg: string, version: string, work: string, problems: string[]) {
  const sdk = path.join(install, "node_modules/@modelcontextprotocol/sdk/dist/esm/client");
  const { Client } = await import(pathToFileURL(path.join(sdk, "index.js")).href);
  const { StdioClientTransport } = await import(pathToFileURL(path.join(sdk, "stdio.js")).href);
  const client = new Client({ name: "axiom-package-smoke", version: "1.0.0" });
  // Launch through the npm bin shim, as `npx -y axiom-mcp` does, so the shebang and
  // executable mode of the published entry point are exercised too.
  const transport = new StdioClientTransport({
    command: path.join(install, "node_modules/.bin/axiom-mcp"),
    args: [],
    cwd: work,
    stderr: "pipe",
    env: { PATH: process.env.PATH ?? "", AXIOM_MCP_MODE: "production", AXIOM_LOG_LEVEL: "error", AXIOM_APPLE_DOCS: "false", TMPDIR: work },
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk).slice(-2000);
  });
  try {
    await client.connect(transport, { timeout: 15_000 });
    const server = client.getServerVersion()?.version;
    if (server !== version) problems.push(`server reports ${server}, package is ${version}`);
    const tools: string[] = (await client.listTools({}, { timeout: 15_000 })).tools.map((tool: { name: string }) => tool.name);
    if (!tools.includes("axiom_read_skill")) problems.push("server does not list axiom_read_skill");
    if (tools.some((name) => name.startsWith("axiom_xcproject")))
      problems.push("xcproject must stay an npm CLI without an MCP wrapper (ADR-004)");
    const response = await client.callTool(
      { name: "axiom_read_skill", arguments: { skills: [{ name: SMOKE_SKILL.name, full: true }] } },
      undefined,
      { timeout: 15_000 },
    );
    const text = response.content.filter((item: { type: string }) => item.type === "text").map((item: { text: string }) => item.text).join("");
    if (response.isError || text.length < 1000)
      problems.push(`axiom_read_skill ${SMOKE_SKILL.name} returned ${response.isError ? "an error" : `${text.length} characters`}`);
    return { server, tools: tools.length };
  } catch (error) {
    throw new Error(`MCP server check failed: ${(error as Error).message}${stderr ? `; server stderr: ${stderr}` : ""}`);
  } finally {
    for (const close of [() => client.close(), () => transport.close()]) {
      try {
        await close();
      } catch (error) {
        problems.push(`MCP shutdown failed: ${(error as Error).message}`);
      }
    }
  }
}

async function main() {
  const keep = process.argv.includes("--keep");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-mcp-package-smoke-"));
  const problems: string[] = [];
  const report: Record<string, unknown> = { problems };
  try {
    if (!fs.existsSync(path.join(pluginDir, SMOKE_SKILL.file)))
      throw new Error(`smoke fixture ${SMOKE_SKILL.file} no longer exists; choose another stable skill`);
    run("npm", ["run", "build:bundle"], mcpDir);
    const [packed] = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", work], mcpDir));
    const tarball = path.join(work, packed.filename);
    const install = path.join(work, "install");
    run("npm", ["install", "--prefix", install, "--no-audit", "--no-fund", tarball], work);
    const pkg = path.join(install, "node_modules/axiom-mcp");
    const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version;
    const canonical = JSON.parse(fs.readFileSync(path.join(pluginDir, "claude-code.json"), "utf8")).version;
    if (version !== canonical) problems.push(`package version ${version} differs from plugin version ${canonical}`);
    // Informational: prepublishOnly rebuilds at publish, so the published tarball's hash differs.
    Object.assign(report, { version, tarball: { file: packed.filename, sha256: sha256(tarball) } });
    for (const file of unexpectedPackedFiles(packed.files.map((entry: { path: string }) => entry.path)))
      problems.push(`unexpected file in the tarball: ${file}`);
    problems.push(...comparePackagedArtifacts(pkg, pluginDir));
    const helpers: Record<string, number | null> = {};
    for (const name of MCP_PACKAGED_BINARIES) {
      const result = spawnSync(path.join(pkg, "dist/bin", name), name === "xclog" ? ["list", "--help"] : ["--help"], {
        cwd: work,
        encoding: "utf8",
        timeout: 10_000,
      });
      helpers[name] = result.status;
      if (result.status !== 0) problems.push(`${name} help exited ${result.status ?? result.error?.message}`);
    }
    report.helpers = helpers;
    report.inspect = inspectFixtures(path.join(install, "node_modules/.bin/xcproject"), work, problems);
    report.mcp = await checkServer(install, pkg, version, work, problems);
  } catch (error) {
    problems.push((error as Error).message);
  } finally {
    if (keep) report.kept = work;
    else fs.rmSync(work, { recursive: true, force: true });
  }
  report.pass = problems.length === 0;
  console.log(JSON.stringify(report));
  process.exitCode = problems.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
