import assert from "node:assert/strict";
import { test } from "node:test";
import { transformAgent } from "./agents.ts";
import { compareCursorPaths } from "./compare.ts";
import {
  CURSOR_AGENT_NAMES,
  CURSOR_COMMAND_NAMES,
  CURSOR_ROUTER_NAMES,
} from "./contract.ts";
import { buildCapabilityReport } from "./report.ts";
import { loadCursorSource } from "./source.ts";

const expectedWarnings = {
  "build-fixer": "Warning: Destructive command detected.",
  "build-optimizer": "Warning: Modifying Xcode project file. Ensure backup exists.",
  "iap-implementation": "Warning: Modifying StoreKit configuration.",
  "simulator-tester": "Warning: Simulator state change command.",
  "test-debugger": "Warning: About to delete test results.",
  "test-runner": "Warning: About to delete test results.",
};

const expectedAdvisories = {
  "build-fixer": "Before running a shell command containing `killall`, deleting DerivedData with `rm -rf`, or erasing a simulator with `xcrun simctl erase`, warn: \"Destructive command detected.\"",
  "build-optimizer": "Before editing or writing a `.pbxproj` file, warn: \"Modifying Xcode project file. Ensure backup exists.\"",
  "iap-implementation": "Before editing or writing a StoreKit-related path or `.storekit` file, warn: \"Modifying StoreKit configuration.\"",
  "simulator-tester": "Before running a `simctl` command that erases, deletes, shuts down, or boots simulator state, warn: \"Simulator state change command.\"",
  "test-debugger": "Before deleting `.xcresult` test results with `rm -rf`, warn: \"About to delete test results.\"",
  "test-runner": "Before deleting `.xcresult` test results with `rm -rf`, warn: \"About to delete test results.\"",
};

function fixture() {
  const source = loadCursorSource(process.cwd());
  const agents = source.agents.map((agent) => transformAgent(agent, "full"));
  return { source, report: buildCapabilityReport(source, agents) };
}

test("capability report enumerates the fixed reviewed router, agent, and command inventories", () => {
  const { report } = fixture();

  assert.deepEqual(
    report.routerDispositions.map((row) => row.name),
    CURSOR_ROUTER_NAMES,
  );
  assert.ok(report.routerDispositions.every((row) => row.disposition === "generated-native-skill"));
  assert.deepEqual(
    report.agentDispositions.map((row) => row.name),
    CURSOR_AGENT_NAMES,
  );
  assert.ok(report.agentDispositions.every((row) =>
    row.disposition === "generated-native-subagent"
      && typeof row.sourceBackground === "boolean"
      && typeof row.releasedBackground === "boolean"
      && (row.authority === "readonly" || row.authority === "writable")
      && row.sourceTools.length > 0
      && row.inheritedAuthority === "Cursor agent inherits its host tool and MCP access.",
  ));
  assert.deepEqual(
    report.commandDispositions.map((row) => row.canonicalName),
    CURSOR_COMMAND_NAMES,
  );
  assert.deepEqual(
    report.commandDispositions.map((row) => row.generatedName),
    CURSOR_COMMAND_NAMES.map((name) => `axiom-${name}`),
  );
  assert.ok(report.commandDispositions.every((row) => row.disposition === "generated-native-command"));
});

test("capability report has exact owner-specific hook coverage and warnings", () => {
  const { source, report } = fixture();
  const expectedIds = source.hooks.map((hook) => [
    hook.source,
    hook.owner ?? "global",
    hook.event,
    hook.matcher ?? "*",
  ].join(":"));

  assert.deepEqual(
    report.hookDispositions.map((row) => row.id),
    expectedIds.sort(compareCursorPaths),
  );
  assert.equal(new Set(report.hookDispositions.map((row) => row.id)).size, source.hooks.length);
  assert.deepEqual(
    Object.fromEntries(
      report.hookDispositions
        .filter((row) => row.source === "agent")
        .map((row) => [row.owner, row.warning]),
    ),
    expectedWarnings,
  );
  assert.deepEqual(
    Object.fromEntries(
      report.hookDispositions
        .filter((row) => row.source === "agent")
        .map((row) => [row.owner, row.advisory]),
    ),
    expectedAdvisories,
  );
  assert.ok(report.hookDispositions
    .filter((row) => row.source === "agent")
    .every((row) => row.disposition === "agent-prompt.advisory"));
});

test("capability report explicitly accounts for MCP, every binary, and Cloud", () => {
  const { report } = fixture();
  assert.deepEqual(report.mcpDispositions, [{
    name: "axiom",
    disposition: "external-runtime-mcp",
    command: "npx -y axiom-mcp",
    bundled: false,
  }]);
  assert.deepEqual(report.binaryDispositions, [
    { name: "xclog", disposition: "external-via-axiom-mcp" },
    { name: "xcprof", disposition: "external-via-axiom-mcp" },
    { name: "xcsym", disposition: "external-via-axiom-mcp" },
    { name: "xcui", disposition: "external-unbundled-no-mcp-wrapper" },
  ]);
  assert.deepEqual(report.cloudDispositions, [{
    name: "Cursor Cloud Agents",
    disposition: "unsupported",
  }]);
});
