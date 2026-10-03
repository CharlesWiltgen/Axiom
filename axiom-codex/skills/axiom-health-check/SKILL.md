---
name: axiom-health-check
description: Use when the user wants a comprehensive project-wide audit, full health check, or scan across all domains.
license: MIT
---
# Health Check Meta-Audit Agent

Run specialized Axiom auditor procedures using the execution mode below, collect their findings, deduplicate by file:line, and produce a unified health report.

Codex does not provide the command launcher that constructs diff scope. If the user requests a diff audit, obtain a verified `DIFF SCOPE` block before auditing; do not fall back to a full audit because the block is missing. The caller must supply the base ref, merge-base SHA, and complete changed Swift-file list. Full audits require no scope block.

## Files to Exclude

Skip: `*Tests.swift`, `*Previews.swift`, `*/Pods/*`, `*/Carthage/*`, `*/.build/*`, `*/DerivedData/*`, `*/scratch/*`, `*/docs/*`, `*/.claude/*`, `*/.claude-plugin/*`

## Phase 0: Determine Audit Scope and User Intent

Before anything else, parse the launch prompt for three optional blocks emitted by the `axiom-health-check` command:

### `DIFF SCOPE` block

```
DIFF SCOPE
Base ref: <base>
Merge-base: <full-SHA>
Changed Swift files (N):
<paths>
```

Determines the audit's file universe:

- **Full audit (default).** No `DIFF SCOPE` block. Phase 1 globs the whole project; Phase 2 lets each auditor scan freely; Phase 4 reports "Scope: full project audit."
- **Diff-scoped audit.** A `DIFF SCOPE` block is present. The provided file list is the universe — Phase 1 uses it directly (no Glob), Phase 2 forwards it to every auditor as a hard constraint, and Phase 4 declares the scope in the report header.

### `EXCLUSIONS` line

`EXCLUSIONS: skip <auditor>, skip <auditor>` — drop the listed auditors from Phase 1's run list. Acknowledge them in the user-facing summary.

### `USER EMPHASIS` line

`USER EMPHASIS: <freeform text>` — the user told you what they care about most (e.g., "focus on memory leaks", "worried about Core Data migrations", "prioritize accessibility").

Emphasis affects **ordering and highlighting, never inclusion or exclusion**:

- It does NOT change which auditors run. Always-run auditors still run. Conditional auditors still trigger by signal. Exclusions still apply.
- It DOES change Phase 4's executive summary — surface findings that match the emphasis first, even if their severity is lower than other findings.
- It DOES affect the summary table's ordering — emphasized domains appear at the top.

If no `USER EMPHASIS` block is present, fall back to severity-only ordering.

Record the mode (full vs diff-scoped), scope metadata (base ref, merge-base SHA, file list, count), exclusions, and emphasis text. Subsequent phases reference this.

## Phase 1: Detect Which Auditors to Run

Gather the Swift-file universe according to Phase 0 mode:

- Full audit: Glob `**/*.swift`.
- Diff-scoped audit: Use the file list from the `DIFF SCOPE` block. Do NOT Glob — the launcher already enumerated the relevant files.

Then use Grep over that file set to detect framework signals.

### Always Run

These auditors apply to every iOS project:

| Auditor | Reason |
|---------|--------|
| memory-auditor | Memory leaks affect all apps |
| security-privacy-scanner | Privacy compliance is mandatory |
| accessibility-auditor | Accessibility is required for App Store |
| swift-performance-analyzer | Performance affects all apps |
| modernization-helper | Deprecated API detection |
| codable-auditor | Serialization issues are universal |

### Conditional (grep for signals)

Run these only when their framework signals are present in the codebase:

| Signal (grep pattern) | Auditor |
|----------------------|---------|
| `import SwiftUI` | swiftui-performance-analyzer, swiftui-architecture-auditor, swiftui-layout-auditor, swiftui-nav-auditor |
| `import SwiftData` or `@Model` | swiftdata-auditor |
| `import CoreData` or `.xcdatamodeld` exists | core-data-auditor |
| `async` or `await` or `actor ` (with trailing space) | concurrency-auditor |
| `Timer.scheduledTimer` or `CLLocationManager` | energy-auditor |
| `AVCaptureSession` | camera-auditor |
| `LanguageModelSession` or `@Generable` | foundation-models-auditor |
| `import SpriteKit` | spritekit-auditor |
| `NWConnection` or `NetworkConnection` | networking-auditor |
| `NSUbiquitousKeyValueStore` or `CKContainer` or `CloudKit` | icloud-auditor |
| `registerMigration` or `DatabaseMigrator` or `ALTER TABLE` | database-schema-auditor |
| `NSTextLayoutManager` or `TextKit` | textkit-auditor |
| `UIScreen.main` or `UIApplicationDelegate`, or `UIRequiresFullScreen` present in an Info.plist | resize-auditor |
| `NavigationStack` or `sheet(` or `TabView` | ux-flow-auditor |
| `FileManager` or `UserDefaults` or `.documentsDirectory` | storage-auditor |
| `XCTestCase` or `@Test` or `@Suite` | testing-auditor |
| `.glassEffect(` or `GlassEffectContainer` or `UIBlurEffect` or `UIVisualEffectView` or `NSVisualEffectView`, or `UIDesignRequiresCompatibility` present in an Info.plist | liquid-glass-auditor |
| Screenshots folder exists (`Screenshots/` or `marketing/`) | screenshot-validator |

### User Exclusions

If the user says "skip X" or "exclude X", remove that auditor from the run list. Acknowledge which auditors were excluded and why.

## Phase 2: Run Selected Auditor Procedures

Read each selected auditor's matching local Codex skill below using an available file reader. If using Axiom MCP instead, call `axiom_get_agent` with the canonical auditor name (the left column below), not `axiom_read_skill` with a generated Codex skill ID. Use the returned procedure as instructions in this execution mode; its Claude model/tool metadata does not select Codex capabilities. Keep one distinct procedure and report per selected auditor; do not merge or omit audits.

Choose execution mode from actual host capabilities and delegation policy:

- If delegation is permitted and `spawn_agent` plus completion tools such as `wait_agent` are available, delegate each procedure with its skill path, Phase 0 scope, exclusions, emphasis, and report destination. Use bounded batches within the host's concurrency limit, counting this orchestrator and already running agents. Wait for results and release occupied slots before starting more; never spawn every auditor at once without checking capacity.
- If delegation is unavailable or prohibited, run the matching skills sequentially in this session, writing each distinct report before the next procedure. Do not invent tools or silently skip audits.
- Preserve the user's requested model and reasoning effort. Otherwise inherit the current model; do not substitute a Claude model label. If the requested model cannot run, report that limitation instead of substituting another model.

Auditor-to-skill mapping:

- `accessibility-auditor` → `axiom-audit-accessibility` (`../axiom-audit-accessibility/SKILL.md`)
- `camera-auditor` → `axiom-audit-camera` (`../axiom-audit-camera/SKILL.md`)
- `codable-auditor` → `axiom-audit-codable` (`../axiom-audit-codable/SKILL.md`)
- `concurrency-auditor` → `axiom-audit-concurrency` (`../axiom-audit-concurrency/SKILL.md`)
- `core-data-auditor` → `axiom-audit-core-data` (`../axiom-audit-core-data/SKILL.md`)
- `database-schema-auditor` → `axiom-audit-database-schema` (`../axiom-audit-database-schema/SKILL.md`)
- `energy-auditor` → `axiom-audit-energy` (`../axiom-audit-energy/SKILL.md`)
- `foundation-models-auditor` → `axiom-audit-foundation-models` (`../axiom-audit-foundation-models/SKILL.md`)
- `icloud-auditor` → `axiom-audit-icloud` (`../axiom-audit-icloud/SKILL.md`)
- `liquid-glass-auditor` → `axiom-audit-liquid-glass` (`../axiom-audit-liquid-glass/SKILL.md`)
- `memory-auditor` → `axiom-audit-memory` (`../axiom-audit-memory/SKILL.md`)
- `modernization-helper` → `axiom-modernize` (`../axiom-modernize/SKILL.md`)
- `networking-auditor` → `axiom-audit-networking` (`../axiom-audit-networking/SKILL.md`)
- `resize-auditor` → `axiom-audit-resize` (`../axiom-audit-resize/SKILL.md`)
- `screenshot-validator` → `axiom-validate-screenshots` (`../axiom-validate-screenshots/SKILL.md`)
- `security-privacy-scanner` → `axiom-scan-security-privacy` (`../axiom-scan-security-privacy/SKILL.md`)
- `spritekit-auditor` → `axiom-audit-spritekit` (`../axiom-audit-spritekit/SKILL.md`)
- `storage-auditor` → `axiom-audit-storage` (`../axiom-audit-storage/SKILL.md`)
- `swift-performance-analyzer` → `axiom-analyze-swift-performance` (`../axiom-analyze-swift-performance/SKILL.md`)
- `swiftdata-auditor` → `axiom-audit-swiftdata` (`../axiom-audit-swiftdata/SKILL.md`)
- `swiftui-architecture-auditor` → `axiom-audit-swiftui-architecture` (`../axiom-audit-swiftui-architecture/SKILL.md`)
- `swiftui-layout-auditor` → `axiom-audit-swiftui-layout` (`../axiom-audit-swiftui-layout/SKILL.md`)
- `swiftui-nav-auditor` → `axiom-audit-swiftui-nav` (`../axiom-audit-swiftui-nav/SKILL.md`)
- `swiftui-performance-analyzer` → `axiom-analyze-swiftui-performance` (`../axiom-analyze-swiftui-performance/SKILL.md`)
- `testing-auditor` → `axiom-audit-testing` (`../axiom-audit-testing/SKILL.md`)
- `textkit-auditor` → `axiom-audit-textkit` (`../axiom-audit-textkit/SKILL.md`)
- `ux-flow-auditor` → `axiom-audit-ux-flow` (`../axiom-audit-ux-flow/SKILL.md`)

Today's date tag for filenames: use ISO format `YYYY-MM-DD`.

Tell each auditor agent to write its output to: `scratch/health-check-{area}-{date}.md`
where `{area}` is the auditor name (e.g., `memory`, `accessibility`, `concurrency`).

**If diff-scoped (Phase 0)**, prepend a scope block to every auditor's launch prompt verbatim:

```
DIFF SCOPE
Only audit the files listed below. Do NOT report findings outside this list, even if your Glob would otherwise match them. Treat this list as the complete universe of source files for this audit.
Files (N):
<paths>
```

The file list is the same one from Phase 0. Auditors will narrow their Glob accordingly, which is the entire reason this mode is fast — no wasted scan of unchanged files.

While auditors run, inform the user:
- Audit scope (full vs `diff vs <base>`, plus file count if diff-scoped)
- How many auditors were launched
- Which are "always run" vs "conditional" (and what signals triggered them)
- Which were skipped (no signal detected) or excluded (user request)

## Phase 3: Collect and Deduplicate

After all auditors complete:

1. Collect each delegated result using the available completion tools, or collect each sequential procedure's summary. Wait for all selected audits to finish or have a recorded failure before proceeding. A failure or unavailable capability is not a passed audit.
2. Read each `scratch/health-check-*-{date}.md` file
3. Parse findings — look for file:line references and severity levels
4. Identify duplicate file:line references across multiple auditor reports
5. Merge duplicates: keep all domain tags (e.g., "memory + concurrency") and the highest severity

## Phase 4: Generate Unified Report

Write to `scratch/health-check-{date}.md` (full audit) or `scratch/health-check-diff-{date}.md` (diff-scoped) with:

### Scope (always the first section)

- Full audit: `Scope: full project audit (N Swift files)`
- Diff-scoped: `` Scope: changed files vs `<base>` (merge-base `<short-SHA>`, N files) ``, followed by the bulleted file list.

This makes it unambiguous to the reader (and to any PR reviewer pasting the report into a comment) what was and wasn't inspected.

### Executive Summary

Top 5 most critical findings across all domains. Each with:
- Severity (CRITICAL/HIGH/MEDIUM/LOW)
- Domain(s)
- File:line
- One-line description

### Findings by Domain

Group findings by domain (memory, accessibility, concurrency, etc.). Within each domain, sort by severity (CRITICAL first).

### Passed Audits

List auditors that found zero issues — this is valuable signal.

### Summary Table

| Auditor | Trigger Reason | Findings | Severity Breakdown | Report File |
|---------|---------------|----------|-------------------|-------------|
| memory-auditor | always | 3 | 1 HIGH, 2 MEDIUM | scratch/health-check-memory-{date}.md |
| ... | ... | ... | ... | ... |

## Output Limits

If >100 total findings across all auditors:
- Show only CRITICAL and HIGH findings in the conversation response
- Reference the scratch files for MEDIUM and LOW findings
- Provide the summary table in full regardless

If <=100 total findings:
- Show all findings grouped by domain in the conversation response

## Guidelines

1. If an auditor fails or times out, note it in the report and continue with others
2. Deduplicate aggressively — the same file:line appearing in 3 auditors should be one finding with 3 domain tags
3. In diff-scoped mode, drop any finding whose file path is not in the Phase 0 file list before deduplicating — auditors may slip and report adjacent files. The scope is a hard boundary.

## Related

For individual audits: Use the specific auditor agent directly (e.g., `memory-auditor`, `accessibility-auditor`)
For build-specific issues: `build-fixer` agent
For test-specific issues: `test-failure-analyzer` agent

## Invocation Examples

Prompts that should launch this agent:

<example>
user: "Run a health check on my project"
assistant: [Launches health-check agent]
</example>

<example>
user: "Scan everything for issues"
assistant: [Launches health-check agent]
</example>

<example>
user: "Give me a full audit of my codebase"
assistant: [Launches health-check agent]
</example>

Explicit command: Users can also invoke this agent directly with `axiom-health-check` or `/axiom:audit all` (Claude Code only)

## Scope

Runs all selected specialized auditor procedures through bounded delegation or sequential execution, deduplicates findings, and produces a unified report.
