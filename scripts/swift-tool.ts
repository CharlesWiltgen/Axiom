import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const plugin = ".claude-plugin/plugins/axiom";
const recordPath = `${plugin}/build-info/xcproject.json`;
const binaryPath = `${plugin}/bin/xcproject`;
const licensePath = `${plugin}/licenses/xcproject.txt`;
const fixedInputs = [
  "tools/xcproject/Package.swift",
  "tools/xcproject/Package.resolved",
  "tools/xcproject/Makefile",
  "tools/xcproject/THIRD_PARTY_LICENSE.txt",
  "scripts/swift-tool.ts",
];

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function swiftToolInputs(root: string): Record<string, string> {
  const manifest = fs.readFileSync(path.join(root, fixedInputs[0]), "utf8");
  if (!/\.executableTarget\s*\(/.test(manifest)) {
    throw new Error("xcproject Package.swift has no executable target");
  }
  const files = [...fixedInputs];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".swift")) {
        files.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, "tools/xcproject/Sources"));
  return Object.fromEntries(
    files.sort().map(
      (file) => [file, sha256(fs.readFileSync(path.join(root, file)))],
    ),
  );
}

export function recordSwiftToolBuild(
  root: string,
  snapshot: Record<string, string>,
): void {
  if (!isDeepStrictEqual(snapshot, swiftToolInputs(root))) {
    throw new Error(
      "xcproject build inputs changed during build; rebuild from a fresh snapshot",
    );
  }
  const license = fs.readFileSync(path.join(root, licensePath));
  if (
    !license.length ||
    !license.equals(
      fs.readFileSync(
        path.join(root, "tools/xcproject/THIRD_PARTY_LICENSE.txt"),
      ),
    )
  ) throw new Error("xcproject installed license differs from source");
  const record = {
    schema: 1,
    inputs: snapshot,
    binary: sha256(fs.readFileSync(path.join(root, binaryPath))),
    license: sha256(license),
  };
  fs.mkdirSync(path.dirname(path.join(root, recordPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, recordPath),
    JSON.stringify(record, null, 2) + "\n",
  );
}

function readIndex(root: string, file: string): Buffer {
  return execFileSync("git", ["show", `:${file}`], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function checkSwiftToolBuild(root: string, index = false): string[] {
  const problems: string[] = [];
  try {
    const inputs = swiftToolInputs(root);
    const read = (file: string) =>
      index ? readIndex(root, file) : fs.readFileSync(path.join(root, file));
    const raw: unknown = JSON.parse(read(recordPath).toString("utf8"));
    if (
      !raw || typeof raw !== "object" || !("schema" in raw) ||
      raw.schema !== 1 || !("inputs" in raw) || !("binary" in raw) ||
      !("license" in raw)
    ) throw new Error("invalid xcproject build record");
    let expected = inputs;
    if (index) {
      const sourceFiles = execFileSync("git", [
        "ls-files",
        "--",
        "tools/xcproject/Sources",
      ], { cwd: root, encoding: "utf8" }).trim().split("\n").filter((p) =>
        p.endsWith(".swift")
      );
      expected = Object.fromEntries(
        [...fixedInputs, ...sourceFiles].sort().map(
          (file) => [file, sha256(read(file))],
        ),
      );
    }
    if (!isDeepStrictEqual(raw.inputs, expected)) {
      problems.push("xcproject build inputs differ from the recorded build");
    }
    if (raw.binary !== sha256(read(binaryPath))) {
      problems.push("xcproject binary differs from the recorded build");
    }
    const license = read(licensePath);
    if (
      !license.length || raw.license !== sha256(license) ||
      !license.equals(read("tools/xcproject/THIRD_PARTY_LICENSE.txt"))
    ) {
      problems.push(
        "xcproject license differs from the recorded build or source",
      );
    }
  } catch (err) {
    problems.push(
      `Cannot verify xcproject ${index ? "index" : "working tree"} build: ${
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
    files = fs.readdirSync(path.join(root, plugin, "bin")).map((name) =>
      `bin/${name}`
    );
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
          !readIndex(root, canonical).equals(readIndex(root, generated))
        ) problems.push(`${generated} differs from canonical in the Git index`);
      }
    } catch (err) {
      problems.push(`Cannot verify ${generated}: ${(err as Error).message}`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  if (process.argv[2] === "snapshot") {
    process.stdout.write(JSON.stringify(swiftToolInputs(root)) + "\n");
  } else if (process.argv[2] === "record" && process.argv[3]) {
    recordSwiftToolBuild(
      root,
      JSON.parse(fs.readFileSync(process.argv[3], "utf8")),
    );
  } else {throw new Error(
      "Usage: swift-tool.ts snapshot | record <pre-build-snapshot.json>",
    );}
}
