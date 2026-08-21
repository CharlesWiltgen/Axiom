import type { VirtualFile } from "./types.ts";

const MCP_DOCUMENT = {
  mcpServers: {
    axiom: {
      command: "npx",
      args: ["-y", "axiom-mcp"],
    },
  },
};

function declaredVariables(pluginJson: unknown): Set<string> {
  if (!pluginJson || typeof pluginJson !== "object" || Array.isArray(pluginJson)) {
    return new Set();
  }
  const variables = (pluginJson as { variables?: unknown }).variables;
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    return new Set();
  }
  const properties = (variables as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return new Set();
  }
  return new Set(Object.keys(properties));
}

function referencedVariables(value: unknown, references: Set<string>): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
      references.add(match[1]!);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) referencedVariables(item, references);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) referencedVariables(item, references);
  }
}

export function validateMcpVariables(pluginJson: unknown, mcpJson: unknown): void {
  const declared = declaredVariables(pluginJson);
  const referenced = new Set<string>();
  referencedVariables(mcpJson, referenced);

  for (const name of referenced) {
    if (!declared.has(name)) throw new Error(`undeclared MCP variable: ${name}`);
  }
  for (const name of declared) {
    if (!referenced.has(name)) throw new Error(`unused MCP variable: ${name}`);
  }
}

export function renderCursorMcp(): VirtualFile {
  return {
    path: "mcp.json",
    content: `${JSON.stringify(MCP_DOCUMENT, null, 2)}\n`,
    mode: 0o644,
  };
}
