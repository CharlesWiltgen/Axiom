export type AgentProfile = "full" | "minimal";
export type Authority = "readonly" | "writable";

export interface VirtualFile {
  path: string;
  content: string;
  mode: 0o644;
}

export interface SourceSkill {
  name: string;
  relativeDir: string;
  frontmatter: Record<string, unknown>;
  body: string;
  resources: VirtualFile[];
}

export interface SourceAgent {
  name: string;
  filename: string;
  frontmatter: Record<string, unknown>;
  body: string;
  tools: string[];
}

export interface SourceCommand {
  name: string;
  filename: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface TransformedAgent {
  name: string;
  authority: Authority;
  sourceBackground: boolean;
  releasedBackground: boolean;
  authorityExpansion: string[];
  file: VirtualFile;
}

export interface SourceHookEntry {
  event: string;
  matcher: string | null;
  command: string;
  source: "global" | "agent";
  owner: string | null;
}

export interface CursorSource {
  version: string;
  description: string;
  author: string;
  license: string;
  manifestSkillNames: string[];
  skills: SourceSkill[];
  excludedMirrors: number;
  agents: SourceAgent[];
  commands: SourceCommand[];
  hooks: SourceHookEntry[];
  logo: string;
  runtimeFiles: VirtualFile[];
}

export interface CapabilityReport {
  routers: number;
  agents: number;
  commands: number;
  excludedMirrors: number;
  globalHookEntries: number;
  perAgentHooks: number;
  releasedReadonlyBackground: number;
  releasedWritableForeground: number;
  authorityExpansions: Array<{
    agent: string;
    sourceTools: string[];
    inherited: string;
  }>;
  dispositions: Record<string, string>;
  routerDispositions: Array<{
    name: string;
    disposition: "generated-native-skill";
    listedInCanonicalManifest: boolean;
  }>;
  agentDispositions: Array<{
    name: string;
    disposition: "generated-native-subagent";
    authority: Authority;
    sourceBackground: boolean;
    releasedBackground: boolean;
    sourceTools: string[];
    inheritedAuthority: "Cursor agent inherits its host tool and MCP access.";
  }>;
  commandDispositions: Array<{
    canonicalName: string;
    generatedName: string;
    disposition: "generated-native-command";
  }>;
  hookDispositions: Array<{
    id: string;
    source: "global" | "agent";
    owner: string | null;
    event: string;
    matcher: string | null;
    disposition: string;
    warning: string | null;
    advisory: string | null;
  }>;
  mcpDispositions: Array<{
    name: "axiom";
    disposition: "external-runtime-mcp";
    command: "npx -y axiom-mcp";
    bundled: false;
  }>;
  binaryDispositions: Array<{
    name: "xclog" | "xcprof" | "xcsym" | "xcui";
    disposition: "external-via-axiom-mcp" | "external-unbundled-no-mcp-wrapper";
  }>;
  cloudDispositions: Array<{
    name: "Cursor Cloud Agents";
    disposition: "unsupported";
  }>;
}
