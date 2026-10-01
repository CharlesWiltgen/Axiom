import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?$/;
const HELPERS = {
  xclog: ["list", "--help"],
  xcsym: ["--help"],
  xcui: ["--help"],
  xcprof: ["--help"],
};
const EVENTS = new Set([
  "SessionStart",
  "UserPromptSubmit",
  "SubagentStart",
  "PostToolUse",
]);
const HANDLERS = new Set([
  "session-start.sh",
  "user-prompt-submit.py",
  "subagent-start.py",
  "posttool-bash-hints.py",
  "swift-guardrails.py",
]);
const LIMIT = 65536;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function version(value) {
  return typeof value === "string" && value.length <= 80 && VERSION.test(value)
    ? value
    : null;
}

/** @typedef {{kind: 'DoctorReadError', operation: 'read_package_file', status: 'missing' | 'invalid'}} DoctorReadError */

async function packageFile(root, relative) {
  try {
    const resolved = await fs.realpath(path.join(root, relative));
    if (!resolved.startsWith(`${root}${path.sep}`))
      return {
        ok: false,
        error: {
          kind: "DoctorReadError",
          operation: "read_package_file",
          status: "invalid",
        },
      };
    const stat = await fs.stat(resolved);
    if (!stat.isFile())
      return {
        ok: false,
        error: {
          kind: "DoctorReadError",
          operation: "read_package_file",
          status: "invalid",
        },
      };
    return { ok: true, file: resolved, stat };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "DoctorReadError",
        operation: "read_package_file",
        status: error.code === "ENOENT" ? "missing" : "invalid",
      },
    };
  }
}

async function readJson(file) {
  const handle = await fs.open(
    file,
    constants.O_RDONLY | (constants.O_NONBLOCK ?? 0),
  );
  try {
    if (!(await handle.stat()).isFile())
      throw new Error("Doctor metadata must be a regular file");
    const buffer = Buffer.alloc(LIMIT + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > LIMIT)
      throw new Error("Doctor metadata exceeds size limit");
    const value = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    if (!isObject(value)) throw new Error("Doctor metadata must be an object");
    return value;
  } finally {
    await handle.close();
  }
}

async function packageJson(root, relative) {
  const result = await packageFile(root, relative);
  if (!result.ok) return { status: result.error.status, value: null };
  try {
    return { status: "ok", value: await readJson(result.file) };
  } catch {
    return { status: "invalid", value: null };
  }
}

function probe(file, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(file, args, {
        cwd,
        stdio: "ignore",
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C" },
      });
    } catch {
      resolve("launch_error");
      return;
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.once("error", () => {
      clearTimeout(timer);
      resolve("launch_error");
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(timedOut ? "timeout" : code === 0 ? "available" : "help_failed");
    });
  });
}

async function inspectHelper(root, name, { platform, arch, timeoutMs }) {
  const result = await packageFile(root, `bin/${name}`);
  if (!result.ok)
    return {
      status: result.error.status === "missing" ? "missing" : "invalid",
    };
  if (!(result.stat.mode & 0o111)) return { status: "not_executable" };
  const handle = await fs.open(result.file, "r");
  let architectures = null;
  try {
    const header = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead >= 8) {
      const magic = header.readUInt32LE(0);
      if (magic === 0xfeedfacf || magic === 0xfeedface)
        architectures = [header.readUInt32LE(4)];
      if (magic === 0xcffaedfe || magic === 0xcefaedfe)
        architectures = [header.readUInt32BE(4)];
      if (header.readUInt32BE(0) === 0xcafebabe) {
        const count = header.readUInt32BE(4);
        if (count > 0 && count <= 16 && bytesRead >= 8 + count * 20) {
          architectures = Array.from({ length: count }, (_, index) =>
            header.readUInt32BE(8 + index * 20),
          );
        } else return { status: "invalid" };
      }
    }
  } finally {
    await handle.close();
  }
  if (architectures && platform !== "darwin")
    return { status: "unsupported_platform" };
  const cpu = { arm64: 0x0100000c, x64: 0x01000007 }[arch];
  const mismatch = architectures && !architectures.includes(cpu);
  // macOS may run x86_64 through Rosetta; a successful help probe settles it.
  const canTranslate =
    platform === "darwin" &&
    arch === "arm64" &&
    architectures?.includes(0x01000007);
  if (mismatch && !canTranslate) return { status: "wrong_architecture" };
  const status = await probe(result.file, HELPERS[name], root, timeoutMs);
  return {
    status:
      mismatch && status === "launch_error" ? "wrong_architecture" : status,
  };
}

export async function inspectInstallation({
  packageRoot,
  hostMetadata = undefined,
  platform = process.platform,
  arch = process.arch,
  timeoutMs = 3000,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
    throw new Error(
      "Doctor helper timeout must be between 1 and 10000 milliseconds",
    );
  const root = await fs.realpath(packageRoot);
  const manifest = await packageJson(root, ".codex-plugin/plugin.json");
  const packageVersion = version(manifest.value?.version);
  const packageStatus =
    manifest.status !== "ok"
      ? manifest.status
      : manifest.value.name === "axiom" &&
          packageVersion &&
          manifest.value.skills === "./skills/" &&
          manifest.value.mcpServers === "./.mcp.json"
        ? "ok"
        : "invalid";
  let skills = { status: "missing", count: 0 };
  try {
    const directory = await fs.realpath(path.join(root, "skills"));
    if (!directory.startsWith(`${root}${path.sep}`))
      throw new Error("Doctor skills path escapes package");
    const entries = await fs.readdir(directory, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        (await packageFile(root, `skills/${entry.name}/SKILL.md`)).ok
      )
        count++;
    }
    skills = { status: count ? "ok" : "missing", count };
  } catch (error) {
    skills.status = error.code === "ENOENT" ? "missing" : "invalid";
  }

  const hookDocument = await packageJson(root, "hooks/hooks.json");
  const hooks = {
    status: hookDocument.status,
    count: 0,
    events: [],
    trust: "unknown",
  };
  const groups = hookDocument.value?.hooks;
  if (hookDocument.status === "ok") {
    if (!isObject(groups) || !Object.keys(groups).length)
      hooks.status = "invalid";
    else {
      for (const [event, entries] of Object.entries(groups)) {
        if (!EVENTS.has(event) || !Array.isArray(entries) || !entries.length) {
          hooks.status = "invalid";
          continue;
        }
        hooks.events.push(event);
        for (const group of entries) {
          if (!Array.isArray(group?.hooks) || !group.hooks.length) {
            hooks.status = "invalid";
            continue;
          }
          for (const handler of group.hooks) {
            hooks.count++;
            const match =
              typeof handler?.command === "string" &&
              handler.command.match(
                /^AXIOM_HARNESS=codex (?:python3 )?"\$\{PLUGIN_ROOT\}\/hooks\/([a-z-]+\.(?:py|sh))"$/,
              );
            if (
              handler?.type !== "command" ||
              !match ||
              !HANDLERS.has(match[1])
            ) {
              hooks.status = "invalid";
              continue;
            }
            const file = await packageFile(root, `hooks/${match[1]}`);
            if (!file.ok) hooks.status = "missing_handler";
            else if (match[1].endsWith(".sh") && !(file.stat.mode & 0o111))
              hooks.status = "not_executable";
            const dependencies =
              {
                "session-start.sh": ["session-start.py", "project_detect.py", "hook_diagnostics.py"],
                "user-prompt-submit.py": ["project_detect.py", "hook_diagnostics.py"],
                "subagent-start.py": ["project_detect.py", "hook_diagnostics.py"],
                "posttool-bash-hints.py": ["hook_diagnostics.py"],
                "swift-guardrails.py": ["hook_diagnostics.py"],
              }[match[1]] ?? [];
            for (const dependency of dependencies) {
              if (!(await packageFile(root, `hooks/${dependency}`)).ok)
                hooks.status = "missing_handler";
            }
          }
        }
      }
      hooks.events.sort();
    }
  }

  const mcpDocument = await packageJson(root, ".mcp.json");
  const server = mcpDocument.value?.mcpServers?.axiom;
  const configuredVersion =
    Array.isArray(server?.args) &&
    server.args.length === 2 &&
    server.args[0] === "-y" &&
    typeof server.args[1] === "string" &&
    server.args[1].startsWith("axiom-mcp@")
      ? version(server.args[1].slice(10))
      : null;
  const mcp = {
    status:
      mcpDocument.status === "ok"
        ? server?.command === "npx" && configuredVersion
          ? "pinned"
          : server?.command === "npx" &&
              JSON.stringify(server.args) === '["-y","axiom-mcp"]'
            ? "unpinned"
            : "invalid"
        : mcpDocument.status,
    configuredVersion,
    observedVersion: null,
    connection: "unknown",
    versionMatch: "unknown",
  };
  const host = { status: "not_supplied", version: null };
  const xcode = { status: "unknown", version: null };
  if (hostMetadata !== undefined) {
    const valid =
      isObject(hostMetadata) &&
      (hostMetadata.runtimeVersion === undefined ||
        version(hostMetadata.runtimeVersion)) &&
      (hostMetadata.hookTrust === undefined ||
        ["trusted", "untrusted", "unknown"].includes(hostMetadata.hookTrust)) &&
      (hostMetadata.mcp === undefined ||
        (isObject(hostMetadata.mcp) &&
          (hostMetadata.mcp.version === undefined ||
            version(hostMetadata.mcp.version)) &&
          (hostMetadata.mcp.status === undefined ||
            ["connected", "unavailable", "unknown"].includes(
              hostMetadata.mcp.status,
            )))) &&
      (hostMetadata.xcode === undefined ||
        (isObject(hostMetadata.xcode) &&
          (hostMetadata.xcode.version == null ||
            version(hostMetadata.xcode.version)) &&
          (hostMetadata.xcode.status === undefined ||
            ["available", "unavailable", "unknown"].includes(
              hostMetadata.xcode.status,
            ))));
    host.status = valid ? "caller_supplied" : "invalid";
    if (valid) {
      host.version = version(hostMetadata.runtimeVersion);
      hooks.trust = hostMetadata.hookTrust ?? "unknown";
      mcp.observedVersion = version(hostMetadata.mcp?.version);
      mcp.connection = hostMetadata.mcp?.status ?? "unknown";
      if (configuredVersion && mcp.observedVersion)
        mcp.versionMatch =
          configuredVersion === mcp.observedVersion ? "match" : "mismatch";
      xcode.status = hostMetadata.xcode?.status ?? "unknown";
      xcode.version = version(hostMetadata.xcode?.version);
    }
  }
  const helperEntries = [];
  for (const name of Object.keys(HELPERS)) {
    try {
      helperEntries.push([
        name,
        await inspectHelper(root, name, { platform, arch, timeoutMs }),
      ]);
    } catch {
      helperEntries.push([name, { status: "invalid" }]);
    }
  }
  return {
    schemaVersion: 1,
    package: { status: packageStatus, version: packageVersion },
    skills,
    hooks,
    mcp,
    helpers: Object.fromEntries(helperEntries),
    host,
    xcode,
  };
}

if (
  process.argv[1] &&
  (await fs.realpath(process.argv[1])) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.includes("--help")) {
      console.log(
        "Usage: node doctor.mjs [--package-root PATH] [--host-metadata PATH]\nRead-only package checks and bounded helper help probes. Host state is unknown unless supplied as sanitized metadata.",
      );
    } else {
      const options = {};
      for (let index = 0; index < args.length; index += 2) {
        if (
          !["--package-root", "--host-metadata"].includes(args[index]) ||
          !args[index + 1] ||
          args[index + 1].startsWith("--")
        )
          throw new Error("Invalid doctor arguments");
        options[args[index]] = args[index + 1];
      }
      let hostMetadata;
      if (options["--host-metadata"]) {
        try {
          hostMetadata = await readJson(options["--host-metadata"]);
        } catch {
          hostMetadata = null;
        }
      }
      const report = await inspectInstallation({
        packageRoot:
          options["--package-root"] ??
          path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
        hostMetadata,
      });
      console.log(JSON.stringify(report, null, 2));
      const broken =
        report.package.status !== "ok" ||
        report.skills.status !== "ok" ||
        report.hooks.status !== "ok" ||
        report.mcp.status !== "pinned" ||
        report.host.status === "invalid" ||
        Object.values(report.helpers).some(
          (helper) =>
            !["available", "unsupported_platform"].includes(helper.status),
        );
      process.exitCode = broken ? 1 : 0;
    }
  } catch {
    console.error(
      "Axiom doctor: installation inspection failed; check package root and arguments.",
    );
    process.exitCode = 1;
  }
}
