#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareDirectories } from "./cursor/compare.ts";
import { renderCursorDistribution, writeCursorDistribution } from "./cursor/render.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Arguments {
  check: boolean;
  output: string | null;
}

function usage(message: string): never {
  throw new Error(`${message}\nUsage: node scripts/build-cursor.ts [--check | --output /absolute/directory] [--profile full]`);
}

function parseArguments(args: string[]): Arguments {
  let check = false;
  let output: string | null = null;
  let profileSeen = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--check") {
      if (check) usage("--check may be specified once");
      check = true;
    } else if (argument === "--output") {
      const value = args[++index];
      if (!value) usage("--output requires an absolute directory");
      if (output !== null) usage("--output may be specified once");
      if (!path.isAbsolute(value)) usage("--output must be absolute");
      output = value;
    } else if (argument === "--profile") {
      const value = args[++index];
      if (!value) usage("--profile requires a value");
      if (profileSeen) usage("--profile may be specified once");
      if (value !== "full") usage(`unsupported Cursor profile: ${value}`);
      profileSeen = true;
    } else {
      usage(`unknown argument: ${argument}`);
    }
  }
  if (check && output !== null) usage("--check cannot be combined with --output");
  return { check, output };
}

function formatDrift(label: string, paths: string[]): string[] {
  return paths.length === 0 ? [] : [`${label}:`, ...paths.map((file) => `  ${file}`)];
}

function check(): number {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-check-"));
  try {
    writeCursorDistribution(temporary, renderCursorDistribution(root, { profile: "full" }));
    const marketplace = compareDirectories(path.join(root, ".cursor-plugin"), path.join(temporary, ".cursor-plugin"));
    const plugin = compareDirectories(path.join(root, "axiom-cursor"), path.join(temporary, "axiom-cursor"));
    const lines = [
      ...formatDrift("marketplace added", marketplace.added),
      ...formatDrift("marketplace removed", marketplace.removed),
      ...formatDrift("marketplace changed", marketplace.changed),
      ...formatDrift("plugin added", plugin.added),
      ...formatDrift("plugin removed", plugin.removed),
      ...formatDrift("plugin changed", plugin.changed),
    ];
    if (lines.length > 0) {
      console.error(["Cursor generated output is stale:", ...lines].join("\n"));
      return 1;
    }
    console.log("Cursor generated output is current.");
    return 0;
  } finally {
    const stat = fs.lstatSync(temporary);
    if (!stat.isDirectory() || stat.isSymbolicLink() || path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith("axiom-cursor-check-")) {
      throw new Error(`refusing to remove unvalidated check directory: ${temporary}`);
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function main(): number {
  const args = parseArguments(process.argv.slice(2));
  if (args.check) return check();
  const destination = args.output ?? root;
  writeCursorDistribution(destination, renderCursorDistribution(root, { profile: "full" }));
  console.log(`Generated Cursor distribution in ${destination}`);
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
