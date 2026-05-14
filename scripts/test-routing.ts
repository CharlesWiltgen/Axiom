#!/usr/bin/env node
/**
 * Routing-accuracy harness for the user-prompt-submit hook.
 *
 * Loads scenarios from scripts/fixtures/routing-scenarios.jsonl and runs each
 * one through the hook. For each scenario, asserts that the matched suites
 * satisfy the scenario's contract:
 *
 *   must_include          — every named suite MUST be in matches
 *   should_include_one_of — at least one of the named suites SHOULD be in matches (soft)
 *   must_not_match        — none of the named suites may be in matches
 *
 * The hook caps matches at 3 (`matches[:3]` in user-prompt-submit.py), so
 * scenarios with must_include longer than 3 will be flagged as authoring bugs.
 *
 * Reads only — never mutates the hook, fixture, or routed suites.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(__filename));

const HOOK = path.join(
  root,
  ".claude-plugin/plugins/axiom/hooks/user-prompt-submit.py",
);
const FIXTURE = path.join(root, "scripts/fixtures/routing-scenarios.jsonl");

interface Scenario {
  name: string;
  prompt: string;
  must_include?: string[];
  should_include_one_of?: string[];
  must_not_match?: string[];
  rationale?: string;
}

interface ScenarioResult {
  scenario: Scenario;
  matches: string[];
  errors: string[];
  warnings: string[];
}

function loadScenarios(file: string): Scenario[] {
  if (!fs.existsSync(file)) {
    throw new Error(`fixture not found: ${file}`);
  }
  const content = fs.readFileSync(file, "utf8");
  const scenarios: Scenario[] = [];
  let lineNo = 0;
  for (const raw of content.split("\n")) {
    lineNo += 1;
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;
    let obj: Scenario;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      throw new Error(`fixture line ${lineNo}: invalid JSON — ${(e as Error).message}`);
    }
    if (!obj.name || typeof obj.name !== "string") {
      throw new Error(`fixture line ${lineNo}: missing 'name'`);
    }
    if (!obj.prompt || typeof obj.prompt !== "string") {
      throw new Error(`fixture line ${lineNo}: '${obj.name}' missing 'prompt'`);
    }
    const total = (obj.must_include?.length ?? 0)
      + (obj.should_include_one_of?.length ?? 0)
      + (obj.must_not_match?.length ?? 0);
    if (total === 0) {
      throw new Error(`fixture line ${lineNo}: '${obj.name}' has no assertions`);
    }
    scenarios.push(obj);
  }
  return scenarios;
}

function runHook(prompt: string): string[] {
  const result = spawnSync("python3", [HOOK], {
    input: JSON.stringify({ prompt }),
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.status !== 0) {
    throw new Error(
      `hook exit=${result.status}: ${result.stderr || result.stdout}`,
    );
  }
  const stdout = (result.stdout || "{}").trim();
  let payload: unknown;
  try {
    payload = JSON.parse(stdout || "{}");
  } catch (e) {
    throw new Error(`hook stdout was not JSON: ${stdout}`);
  }
  const ctx = (payload as { hookSpecificOutput?: { additionalContext?: string } })
    ?.hookSpecificOutput?.additionalContext ?? "";
  // Skills appear as `axiom-name` (backtick-wrapped) in the context string.
  // Matching the test harness in user-prompt-submit_test.py.
  const matched = new Set<string>();
  for (const m of ctx.matchAll(/`(axiom-[a-z-]+)`/g)) {
    matched.add(m[1]);
  }
  return [...matched].sort();
}

function evaluate(scenario: Scenario, matches: string[]): ScenarioResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const set = new Set(matches);

  for (const required of scenario.must_include ?? []) {
    if (!set.has(required)) {
      errors.push(`missing required suite: ${required}`);
    }
  }

  if (scenario.should_include_one_of && scenario.should_include_one_of.length > 0) {
    const found = scenario.should_include_one_of.some((s) => set.has(s));
    if (!found) {
      warnings.push(
        `none of optional suites matched: ${scenario.should_include_one_of.join(", ")}`,
      );
    }
  }

  for (const forbidden of scenario.must_not_match ?? []) {
    if (set.has(forbidden)) {
      errors.push(`unexpected suite matched: ${forbidden}`);
    }
  }

  // The hook caps matches at 3 — flag authoring bugs in the fixture.
  if ((scenario.must_include?.length ?? 0) > 3) {
    warnings.push(
      `must_include has >3 entries; hook caps matches at 3 (will always fail)`,
    );
  }

  return { scenario, matches, errors, warnings };
}

function main(): void {
  if (!fs.existsSync(HOOK)) {
    console.error(`hook not found at ${HOOK}`);
    process.exit(2);
  }

  let scenarios: Scenario[];
  try {
    scenarios = loadScenarios(FIXTURE);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }

  console.log(`Running ${scenarios.length} routing scenarios against hook…\n`);

  let passed = 0;
  let failed = 0;
  let warned = 0;
  const failures: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    let matches: string[];
    try {
      matches = runHook(scenario.prompt);
    } catch (e) {
      failed += 1;
      const msg = (e as Error).message;
      console.log(`  ✗ ${scenario.name} — hook invocation failed: ${msg}`);
      failures.push({
        scenario,
        matches: [],
        errors: [`hook invocation failed: ${msg}`],
        warnings: [],
      });
      continue;
    }
    const result = evaluate(scenario, matches);
    if (result.errors.length > 0) {
      failed += 1;
      console.log(`  ✗ ${scenario.name}`);
      console.log(`      matched: [${matches.join(", ") || "(none)"}]`);
      for (const err of result.errors) console.log(`      ERROR: ${err}`);
      for (const warn of result.warnings) console.log(`      warn:  ${warn}`);
      failures.push(result);
    } else if (result.warnings.length > 0) {
      warned += 1;
      console.log(`  ⚠ ${scenario.name} — matched: [${matches.join(", ")}]`);
      for (const warn of result.warnings) console.log(`      warn:  ${warn}`);
      passed += 1; // soft failures still count as pass
    } else {
      passed += 1;
      console.log(`  ✓ ${scenario.name} — matched: [${matches.join(", ")}]`);
    }
  }

  console.log("");
  console.log(`  ${passed}/${scenarios.length} passed`);
  if (warned > 0) console.log(`  ${warned} warning(s) — soft assertion(s) unmet`);
  if (failed > 0) {
    console.log(`  ${failed} failure(s)\n`);
    console.log("Failures detail:");
    for (const f of failures) {
      console.log(`  - ${f.scenario.name}`);
      if (f.scenario.rationale) console.log(`    rationale: ${f.scenario.rationale}`);
      for (const e of f.errors) console.log(`    ${e}`);
    }
    process.exit(1);
  }
  console.log("\n✓ All routing scenarios passed\n");
}

main();
