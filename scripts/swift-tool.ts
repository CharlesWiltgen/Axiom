import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export const swiftToolNames = ["xcproject", "axbuild"] as const;
export type SwiftToolName = typeof swiftToolNames[number];
type SwiftToolBuildError = Error & { readonly domain: "swift-tool-build" };
const plugin = ".claude-plugin/plugins/axiom";

function buildError(message: string): SwiftToolBuildError {
  return Object.assign(new Error(message), {
    domain: "swift-tool-build" as const,
  });
}
function definition(tool: SwiftToolName) {
  if (!swiftToolNames.includes(tool)) {
    throw buildError(`Unknown Swift tool: ${tool}`);
  }
  const sourceRoot = `tools/${tool}`;
  return {
    sourceRoot,
    fixedInputs: [
      `${sourceRoot}/Package.swift`,
      `${sourceRoot}/Makefile`,
      ...(tool === "xcproject"
        ? [
          `${sourceRoot}/Package.resolved`,
          `${sourceRoot}/THIRD_PARTY_LICENSE.txt`,
        ]
        : []),
    ],
    recordPath: `${plugin}/build-info/${tool}.json`,
    binaryPath: `${plugin}/bin/${tool}`,
    licensePath: tool === "xcproject"
      ? `${plugin}/licenses/xcproject.txt`
      : undefined,
  };
}
function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
function productionSource(file: string): boolean {
  return file.endsWith(".swift") && !file.endsWith(".test.swift") &&
    !file.endsWith(".spec.swift") && !file.split("/").includes("Fixtures");
}
function readIndex(root: string, file: string): Buffer {
  return execFileSync("git", ["show", `:${file}`], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}
function buildInputs(
  root: string,
  tool: SwiftToolName,
  index: boolean,
): Record<string, string> {
  const spec = definition(tool);
  const read = (file: string) =>
    index ? readIndex(root, file) : fs.readFileSync(path.join(root, file));
  if (
    !/\.executableTarget\s*\(/.test(read(spec.fixedInputs[0]).toString("utf8"))
  ) throw buildError(`${tool} Package.swift has no executable target`);
  const files = [...spec.fixedInputs];
  if (index) {
    files.push(
      ...execFileSync("git", [
        "ls-files",
        "-z",
        "--",
        `${spec.sourceRoot}/Sources`,
      ], { cwd: root, encoding: "utf8" }).split("\0").filter(productionSource),
    );
  } else {
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "Fixtures") walk(full);
        else if (entry.isFile() && productionSource(full)) {
          files.push(path.relative(root, full));
        }
      }
    };
    walk(path.join(root, spec.sourceRoot, "Sources"));
  }
  return Object.fromEntries(
    files.sort().map((file) => [file, sha256(read(file))]),
  );
}
export function swiftToolInputs(
  root: string,
  tool: SwiftToolName = "xcproject",
): Record<string, string> {
  return buildInputs(root, tool, false);
}
export function recordSwiftToolBuild(
  root: string,
  snapshot: Record<string, string>,
  tool: SwiftToolName = "xcproject",
): void {
  const spec = definition(tool);
  if (!isDeepStrictEqual(snapshot, swiftToolInputs(root, tool))) {
    throw buildError(
      `${tool} build inputs changed during build; rebuild from a fresh snapshot`,
    );
  }
  if (!(fs.statSync(path.join(root, spec.binaryPath)).mode & 0o111)) {
    throw buildError(`${tool} installed binary is not executable`);
  }
  let license: string | undefined;
  if (spec.licensePath) {
    const installed = fs.readFileSync(path.join(root, spec.licensePath));
    if (
      !installed.length ||
      !installed.equals(
        fs.readFileSync(
          path.join(root, spec.sourceRoot, "THIRD_PARTY_LICENSE.txt"),
        ),
      )
    ) throw buildError(`${tool} installed license differs from source`);
    license = sha256(installed);
  }
  const record = {
    schema: 1,
    inputs: snapshot,
    binary: sha256(fs.readFileSync(path.join(root, spec.binaryPath))),
    ...(license ? { license } : {}),
  };
  fs.mkdirSync(path.dirname(path.join(root, spec.recordPath)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, spec.recordPath),
    JSON.stringify(record, null, 2) + "\n",
  );
}
export function checkSwiftToolBuild(
  root: string,
  index = false,
  tool: SwiftToolName = "xcproject",
): string[] {
  const problems: string[] = [];
  try {
    const spec = definition(tool);
    const read = (file: string) =>
      index ? readIndex(root, file) : fs.readFileSync(path.join(root, file));
    const raw: unknown = JSON.parse(read(spec.recordPath).toString("utf8"));
    if (
      !raw || typeof raw !== "object" || !("schema" in raw) ||
      raw.schema !== 1 || !("inputs" in raw) || !("binary" in raw) ||
      typeof raw.binary !== "string" ||
      (spec.licensePath && !("license" in raw))
    ) throw buildError(`invalid ${tool} build record`);
    if (!isDeepStrictEqual(raw.inputs, buildInputs(root, tool, index))) {
      problems.push(`${tool} build inputs differ from the recorded build`);
    }
    if (raw.binary !== sha256(read(spec.binaryPath))) {
      problems.push(`${tool} binary differs from the recorded build`);
    }
    const executable = index
      ? execFileSync("git", ["ls-files", "--stage", "--", spec.binaryPath], {
        cwd: root,
        encoding: "utf8",
      }).startsWith("100755 ")
      : !!(fs.statSync(path.join(root, spec.binaryPath)).mode & 0o111);
    if (!executable) {
      problems.push(
        `${tool} binary is not executable in the ${
          index ? "index" : "working tree"
        }`,
      );
    }
    if (spec.licensePath) {
      const license = read(spec.licensePath);
      if (
        !license.length || !("license" in raw) ||
        raw.license !== sha256(license) ||
        !license.equals(read(`${spec.sourceRoot}/THIRD_PARTY_LICENSE.txt`))
      ) {
        problems.push(
          `${tool} license differs from the recorded build or source`,
        );
      }
    }
  } catch (err) {
    problems.push(
      `Cannot verify ${tool} ${index ? "index" : "working tree"} build: ${
        (err as Error).message
      }`,
    );
  }
  return problems;
}

export function checkCodexToolArtifacts(
  root: string,
  index: boolean,
): string[] {
  const problems: string[] = [];
  let files: string[];
  try {
    // Same filter as build-codex.ts and session-start.py: dotfiles are not helpers.
    files = fs.readdirSync(path.join(root, plugin, "bin"))
      .filter((name) => !name.startsWith("."))
      .map((name) => `bin/${name}`);
  } catch (err) {
    return [
      `Cannot enumerate canonical helper binaries: ${(err as Error).message}`,
    ];
  }
  files.push("licenses/xcproject.txt");
  for (const file of files) {
    const canonical = `${plugin}/${file}`;
    const generated = `axiom-codex/${file}`;
    try {
      const source = fs.readFileSync(path.join(root, canonical));
      const output = fs.readFileSync(path.join(root, generated));
      const sourceMode = fs.statSync(path.join(root, canonical)).mode & 0o777;
      const outputMode = fs.statSync(path.join(root, generated)).mode & 0o777;
      if (
        !source.equals(output) ||
        (file.startsWith("bin/") &&
          (sourceMode !== outputMode || !(outputMode & 0o111)))
      ) {
        problems.push(
          `${generated} differs from its canonical bytes or executable mode`,
        );
      }
      if (index) {
        const entries = execFileSync("git", [
          "ls-files",
          "--stage",
          "--",
          canonical,
          generated,
        ], { cwd: root, encoding: "utf8" }).trim().split("\n");
        if (
          entries.length !== 2 ||
          (file.startsWith("bin/") &&
            entries.some((entry) => entry.split(" ")[0] !== "100755")) ||
          entries[0].split(" ")[0] !== entries[1].split(" ")[0] ||
          // Blob SHAs from the same ls-files call; equal SHAs mean equal bytes,
          // without reading ~65 MB of binaries through git show.
          entries[0].split(" ")[1] !== entries[1].split(" ")[1]
        ) problems.push(`${generated} differs from canonical in the Git index`);
      }
    } catch (err) {
      problems.push(`Cannot verify ${generated}: ${(err as Error).message}`);
    }
  }
  return problems;
}

function parseTool(value: string | undefined): SwiftToolName {
  const selected = value ?? "xcproject";
  if (selected === "xcproject" || selected === "axbuild") return selected;
  throw buildError(`Unknown Swift tool: ${selected}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  if (process.argv[2] === "snapshot" && process.argv.length <= 4) {
    process.stdout.write(
      JSON.stringify(swiftToolInputs(root, parseTool(process.argv[3]))) + "\n",
    );
  } else if (
    process.argv[2] === "record" && process.argv[3] && process.argv.length <= 5
  ) {
    recordSwiftToolBuild(
      root,
      JSON.parse(fs.readFileSync(process.argv[3], "utf8")),
      parseTool(process.argv[4]),
    );
  } else {throw buildError(
      "Usage: swift-tool.ts snapshot [tool] | record <pre-build-snapshot.json> [tool]",
    );}
}
