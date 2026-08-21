import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCursorMcp, validateMcpVariables } from "./mcp.ts";

test("MCP uses plugin-root discovery and Axiom's existing launch convention", () => {
  const file = renderCursorMcp();

  assert.equal(file.path, "mcp.json");
  assert.equal(file.mode, 0o644);
  assert.ok(file.content.endsWith("\n"));
  assert.deepEqual(JSON.parse(file.content), {
    mcpServers: { axiom: { command: "npx", args: ["-y", "axiom-mcp"] } },
  });
});

test("undeclared MCP variables fail generation", () => {
  assert.throws(
    () => validateMcpVariables({ name: "axiom" }, {
      mcpServers: { x: { env: { TOKEN: "${TOKEN}" } } },
    }),
    /undeclared MCP variable: TOKEN/,
  );
});

test("declared MCP variables must be used by a placeholder", () => {
  assert.throws(
    () => validateMcpVariables({
      name: "axiom",
      variables: { properties: { TOKEN: { type: "string" } } },
    }, { mcpServers: { axiom: { command: "npx" } } }),
    /unused MCP variable: TOKEN/,
  );
});

test("nested declared MCP variables are accepted", () => {
  assert.doesNotThrow(() => validateMcpVariables({
    variables: { properties: { TOKEN: { type: "string" } } },
  }, {
    mcpServers: { axiom: { env: { TOKEN: "${TOKEN}" } } },
  }));
});
