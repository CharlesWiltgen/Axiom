/**
 * Axiom commands, ported to Pi.
 *
 * Each Axiom `/axiom:*` command launches an agent in Claude Code. Pi has no
 * sub-agent system, so each command instead registers as `/axiom-<name>` and
 * sends a natural-language prompt that triggers the matching skill inline.
 *
 * Pure data + prompt builders — no Pi imports, so the table is unit-testable.
 */

export type AxiomCommand = {
  /** Registered as `/<name>` in Pi. */
  name: string;
  description: string;
  /** Argument completions offered after the command (e.g. audit areas). */
  completions?: readonly string[];
  /** Builds the user message that triggers the matching skill workflow. */
  prompt: (args: string) => string;
};

/** Audit areas accepted by `/axiom-audit` (mirrors the Claude command argument). */
export const AUDIT_AREAS = [
  "all", "memory", "concurrency", "accessibility", "energy",
  "swiftui-performance", "swiftui-architecture", "swiftui-nav", "swiftui-layout",
  "swift-performance", "core-data", "swiftdata", "database-schema", "networking",
  "codable", "icloud", "storage", "liquid-glass", "textkit", "testing", "build",
  "spritekit", "security", "modernization", "camera", "foundation-models",
  "screenshots", "ux-flow",
] as const;

export const AXIOM_COMMANDS: readonly AxiomCommand[] = [
  {
    name: "axiom-fix-build",
    description: "Diagnose and fix an Xcode build failure (environment-first)",
    prompt: () =>
      "My Xcode build is failing. Use the axiom-build skill to diagnose it " +
      "environment-first — check for zombie xcodebuild processes " +
      "(`pgrep -x xcodebuild`), Derived Data, the SPM cache, and simulator " +
      "state before touching code — then apply the fix and verify it builds.",
  },
  {
    name: "axiom-audit",
    description: "Run an Axiom code audit (memory, concurrency, security, …) or suggest relevant ones",
    completions: AUDIT_AREAS,
    prompt: (args) => {
      const area = args.trim();
      if (!area) {
        return "Analyze this project's structure and tell me which Axiom audits " +
          "are most relevant (memory, concurrency, data safety, performance, " +
          "security, accessibility, UX), then run the ones I confirm.";
      }
      if (area === "all") {
        return "Run a full Axiom health check across all relevant domains and " +
          "give a unified, prioritized report.";
      }
      return `Run an Axiom ${area} audit on this codebase using the matching ` +
        "skill. Report findings by severity (CRITICAL/HIGH/MEDIUM/LOW) with " +
        "file:line and concrete fixes.";
    },
  },
  {
    name: "axiom-health-check",
    description: "Full project health check across all Axiom audit domains",
    prompt: () =>
      "Run a full Axiom health check on this project — audit across memory, " +
      "concurrency, data safety, performance, networking, security, and " +
      "accessibility, then give one prioritized, de-duplicated report.",
  },
  {
    name: "axiom-analyze-crash",
    description: "Symbolicate and triage a crash report (.ips, MetricKit, .crash, .xccrashpoint)",
    prompt: (args) => {
      const f = args.trim();
      const target = f ? `: ${f}` : " (point me at the file if I haven't given a path)";
      return `Analyze this crash report${target}. Run ` +
        "`xcsym crash --format=summary` to symbolicate and categorize it, then " +
        "explain the crash pattern and the fix. See the axiom-tools crash workflow.";
    },
  },
  {
    name: "axiom-triage",
    description: "Triage a corpus of production crashes from Sentry / App Store Connect",
    prompt: (args) =>
      `Triage my production crashes${args.trim() ? ` from ${args.trim()}` : ""} — ` +
      "fetch the unresolved issues, run `xcsym triage` to classify and cluster " +
      "them, flag suspension/idle-runloop noise, and rank the root-cause families " +
      "to fix first.",
  },
  {
    name: "axiom-console",
    description: "Capture simulator console output with xclog",
    prompt: (args) =>
      `Capture the simulator console with \`xclog\`${args.trim() ? ` for ${args.trim()}` : ""} — ` +
      "use `xclog list` to find the bundle id, then " +
      "`xclog launch <bundle-id> --timeout 30s --max-lines 200` for a bounded " +
      "capture, and summarize errors. See axiom-tools (xclog-ref).",
  },
  {
    name: "axiom-ui",
    description: "Drive and validate the simulator UI & accessibility with xcui",
    prompt: (args) =>
      `Drive and validate the simulator UI with \`xcui\`${args.trim() ? `: ${args.trim()}` : ""}. ` +
      "Run `xcui doctor` first, then tap by accessibility id, dump the " +
      "accessibility tree, and assert on labels/traits/VoiceOver/Dynamic Type. " +
      "See axiom-tools (xcui-ref).",
  },
  {
    name: "axiom-profile",
    description: "Record and analyze a CPU/performance trace with xcprof (no Instruments GUI)",
    prompt: (args) =>
      `Profile my app's performance with \`xcprof\`${args.trim() ? ` (${args.trim()})` : ""} — ` +
      "`xcprof record --preset cpu --attach <pid|name>` then " +
      "`xcprof analyze <trace> --json`, and give an honest hot-frame report. " +
      "See axiom-tools (xcprof-ref).",
  },
  {
    name: "axiom-compare-traces",
    description: "Diff two performance traces for CPU regressions (xcprof compare)",
    prompt: (args) =>
      "Compare two performance traces for CPU-share regressions with " +
      `\`xcprof compare <baseline> <current>\`${args.trim() ? `: ${args.trim()}` : ""} ` +
      "and report what regressed. See the axiom-performance trace-comparison workflow.",
  },
  {
    name: "axiom-optimize-build",
    description: "Find and apply Xcode build-time optimizations",
    prompt: () =>
      "Analyze my Xcode build performance and suggest optimizations — slow " +
      "type-checking expressions, expensive build-phase scripts, suboptimal " +
      "build settings, and parallelization opportunities. Use the axiom-build skill.",
  },
  {
    name: "axiom-run-tests",
    description: "Run XCUITests and parse the results",
    prompt: (args) =>
      `Run my tests${args.trim() ? ` (${args.trim()})` : ""} with xcodebuild, parse ` +
      "the .xcresult, and show failures with details and attachments. Use the " +
      "axiom-testing skill.",
  },
  {
    name: "axiom-test-simulator",
    description: "Run a simulator test scenario with visual + accessibility verification",
    prompt: (args) =>
      `Set up and run a simulator test scenario${args.trim() ? `: ${args.trim()}` : ""} — ` +
      "drive the UI with `xcui`, capture screenshots for visual verification, " +
      "assert on the accessibility tree, and check logs for crashes/errors.",
  },
  {
    name: "axiom-screenshot",
    description: "Capture a simulator screenshot for verification",
    prompt: (args) =>
      `Capture a simulator screenshot${args.trim() ? ` of ${args.trim()}` : " of the current screen"} ` +
      "and verify the UI state (no placeholder text, correct layout, no debug overlays).",
  },
  {
    name: "axiom-status",
    description: "Axiom project health dashboard (environment + suggestions)",
    prompt: () =>
      "Show the Axiom project health dashboard — read the environment " +
      "(IPHONEOS_DEPLOYMENT_TARGET, Xcode version, simulator state, available " +
      "Axiom tools) and suggest concrete improvements.",
  },
  {
    name: "axiom-ask",
    description: "Ask an iOS/Swift question routed to the right Axiom skill",
    prompt: (args) =>
      args.trim()
        ? `Answer this iOS/Swift question, loading the most relevant Axiom skill first: ${args.trim()}`
        : "What iOS/Swift question can I help with? I'll route it to the most relevant Axiom skill.",
  },
];
