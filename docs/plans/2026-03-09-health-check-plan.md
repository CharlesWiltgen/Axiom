# Health Check Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a meta-audit agent that auto-detects relevant auditors, runs them in parallel, deduplicates findings by file:line, and produces a single prioritized report.

**Architecture:** A single agent file (`health-check.md`) that orchestrates existing auditors. A command file (`health-check.md`) for `/axiom:health-check`. Updates to `audit.md` command for `/axiom:audit all` alias. Agent description added to `claude-code.json` manifest. VitePress doc page.

**Tech Stack:** Agent markdown, Claude Code agent system, existing 26 auditors

---

### Task 1: Create the Health Check Agent

**Files:**
- Create: `.claude-plugin/plugins/axiom/agents/health-check.md`

**Context:**
- Follow the agent format from `memory-auditor.md` (frontmatter with name, description, model, tools, skills)
- The agent uses `sonnet` model (needs to orchestrate, not just grep)
- Tools: `Glob`, `Grep`, `Read`, `Write` (Write for the report file)
- Skills: `axiom-ios-build` (for project structure understanding)
- Background: false (this is the orchestrator — it launches sub-agents in background)

**Step 1: Create the agent file**

```markdown
---
name: health-check
description: |
  Use this agent when the user wants a comprehensive project health check, full audit, or asks to "scan everything". Auto-detects which auditors are relevant based on project structure, runs them in parallel, deduplicates findings by file:line, and produces a single prioritized report.

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

  Explicit command: Users can also invoke this agent directly with `/axiom:health-check` or `/axiom:audit all`
model: sonnet
background: false
color: green
tools:
  - Glob
  - Grep
  - Read
  - Write
  - Agent
skills:
  - axiom-ios-build
---

# Health Check Agent

You are a meta-audit orchestrator. Your job is to determine which auditors are relevant for this project, launch them all in parallel, collect results, deduplicate, and produce one unified report.

## Phase 1: Auto-Detect Relevant Auditors

Scan the project to determine which auditors to run. Use Grep to check for framework signals.

### Always-Run Auditors

These apply to every Swift project — always include them:
- `memory-auditor`
- `security-privacy-scanner`
- `accessibility-auditor`
- `swift-performance-analyzer`
- `modernization-helper`
- `codable-auditor`

### Conditional Auditors

Run Grep checks for these signals. If found, add the auditor:

| Signal Pattern | Auditor |
|---------------|---------|
| `import SwiftUI` | `swiftui-performance-analyzer`, `swiftui-architecture-auditor`, `swiftui-layout-auditor`, `swiftui-nav-auditor` |
| `import SwiftData` or `@Model` | `swiftdata-auditor` |
| `import CoreData` or `*.xcdatamodeld` exists | `core-data-auditor` |
| `async` or `await` or `actor ` | `concurrency-auditor` |
| `Timer.scheduledTimer` or `CLLocationManager` | `energy-auditor` |
| `AVCaptureSession` | `camera-auditor` |
| `LanguageModelSession` or `@Generable` | `foundation-models-auditor` |
| `import SpriteKit` | `spritekit-auditor` |
| `NWConnection` or `NetworkConnection` | `networking-auditor` |
| `NSUbiquitousKeyValueStore` or `CKContainer` or `CloudKit` | `icloud-auditor` |
| `registerMigration` or `DatabaseMigrator` or `ALTER TABLE` | `database-schema-auditor` |
| `TextKit` or `NSTextLayoutManager` | `textkit-auditor` |

### User Exclusions

If the user said "skip X", remove that auditor from the list before launching.

## Phase 2: Launch Auditors

1. Print which auditors will run and why: "Launching N auditors: [list with detection reason]"
2. Launch ALL auditors in parallel using the Agent tool with `run_in_background: true`
3. Each agent prompt should include: "Write your full detailed report to scratch/health-check-{area}-{date}.md where {date} is today's date in YYYY-MM-DD format. Return only a summary with issue counts by severity (CRITICAL/HIGH/MEDIUM/LOW). Skip any files in scratch/, docs/, .claude/, .claude-plugin/."
4. Wait for all agents to complete

## Phase 3: Collect and Deduplicate

After all agents return:

1. Parse each agent's summary for issue counts
2. Read the scratch files for full details
3. Scan for duplicate file:line references across reports
4. When duplicates found, merge into single finding with multiple domain tags:
   `[Memory, Concurrency] AppViewModel.swift:47 — closure captures self strongly`

## Phase 4: Generate Report

Write the unified report to `scratch/health-check-{date}.md`:

```markdown
# Swift Health Check — {Project Name}
## {Date} — {N} auditors ran, {M} total findings

### Critical Findings

{Top 5 most severe findings across all domains, with domain tags}

### {Domain 1} ({count} findings)

{Findings sorted by severity}

### {Domain 2} ({count} findings)

{Findings sorted by severity}

...

### Passed Audits

{List auditors that found zero issues with ✓}

### Auditors Run

| Auditor | Reason | Findings | File |
|---------|--------|----------|------|
| memory | Always | 3 | scratch/health-check-memory-{date}.md |
| concurrency | async/await detected | 5 | scratch/health-check-concurrency-{date}.md |
```

Also display the Critical Findings section and summary table directly in the conversation.

## Output Limits

- If total findings exceed 100: Show only CRITICAL and HIGH in conversation, reference scratch files for MEDIUM/LOW
- Always show the summary table regardless of finding count
- Individual audit scratch files contain full details
```

**Step 2: Verify the file exists and has correct frontmatter**

```bash
head -20 .claude-plugin/plugins/axiom/agents/health-check.md
```

**Step 3: Commit**

```bash
git add .claude-plugin/plugins/axiom/agents/health-check.md
git commit -m "feat: add health-check meta-audit agent"
```

---

### Task 2: Create the Health Check Command

**Files:**
- Create: `.claude-plugin/plugins/axiom/commands/health-check.md`

**Context:**
- Follow the command format from `audit.md` — frontmatter with description and disable-model-invocation
- This command simply launches the health-check agent
- Keep it minimal — all logic lives in the agent

**Step 1: Create the command file**

```markdown
---
description: Run a comprehensive health check — auto-detects relevant auditors, runs them in parallel, produces a unified report
disable-model-invocation: true
---

You are the health check launcher.

## Your Task

Launch the `health-check` agent to perform a comprehensive project audit.

If the user provided arguments ($ARGUMENTS), pass them as exclusions. For example:
- "skip memory skip energy" → Tell the agent to exclude memory-auditor and energy-auditor
- No arguments → Run all relevant auditors

$ARGUMENTS
```

**Step 2: Verify the file exists**

```bash
cat .claude-plugin/plugins/axiom/commands/health-check.md
```

**Step 3: Commit**

```bash
git add .claude-plugin/plugins/axiom/commands/health-check.md
git commit -m "feat: add /axiom:health-check command"
```

---

### Task 3: Add "all" Alias to Audit Command

**Files:**
- Modify: `.claude-plugin/plugins/axiom/commands/audit.md`

**Context:**
- Add handling for `/axiom:audit all` that launches the health-check agent
- Insert at the top of the "Direct Dispatch" section, before individual area lookup

**Step 1: Read the current audit.md file**

Already read above. The change goes in the "Direct Dispatch" section after line 48.

**Step 2: Add the "all" handler**

After `If area argument provided ($ARGUMENTS contains an area):` (line 48), add before the existing steps:

```markdown
If $ARGUMENTS is "all" → Launch the `health-check` agent instead. This runs all relevant auditors in parallel with a unified report.
```

**Step 3: Update the argument description**

In the frontmatter `argument:` field, prepend `all` to the list of areas.

**Step 4: Verify the edit**

```bash
head -10 .claude-plugin/plugins/axiom/commands/audit.md
grep -n "all" .claude-plugin/plugins/axiom/commands/audit.md
```

**Step 5: Commit**

```bash
git add .claude-plugin/plugins/axiom/commands/audit.md
git commit -m "feat: add 'all' option to /axiom:audit for full health check"
```

---

### Task 4: Register Agent in Plugin Manifest

**Files:**
- Modify: `.claude-plugin/plugins/axiom/claude-code.json`

**Context:**
- The health-check agent needs a command entry in `claude-code.json` for the `/axiom:health-check` command
- Add command reference: `"./commands/health-check.md"`
- Do NOT add to skills array (this is an agent/command, not a skill)
- Do NOT update the version number

**Step 1: Read current claude-code.json commands section**

Check the `commands` array in the manifest.

**Step 2: Add the health-check command**

Add `"./commands/health-check.md"` to the `commands` array.

**Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugins/axiom/claude-code.json', 'utf8')); console.log('Valid JSON')"
```

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/claude-code.json
git commit -m "feat: register health-check command in plugin manifest"
```

---

### Task 5: Create VitePress Documentation Page

**Files:**
- Create: `docs/commands/health-check.md`
- Modify: `docs/commands/index.md` (add entry)

**Context:**
- Follow command doc template from `.claude/rules/documentation-standards.md`
- Keep it concise — command pages are short

**Step 1: Create the doc page**

```markdown
# Health Check

Comprehensive project health check that auto-detects relevant auditors, runs them in parallel, and produces a single prioritized report.

## What It Does

- Scans project structure to detect which frameworks and patterns are used
- Launches all relevant auditors in parallel (6 always-run + conditional)
- Deduplicates findings that appear across multiple auditors (same file:line)
- Produces unified report with executive summary + grouped details
- Writes full results to `scratch/health-check-*.md` files

## Usage

```
/axiom:health-check
```

Or via the audit command:

```
/axiom:audit all
```

### Excluding Auditors

```
/axiom:health-check skip spritekit skip camera
```

## Auto-Detection

The agent detects which auditors are relevant by scanning for framework imports, file types, and code patterns. Six auditors always run (memory, security, accessibility, swift-performance, modernization, codable). Others activate based on what's found in your project.

## Output

Results appear in two places:
1. **Conversation** — Executive summary with top 5 critical findings + summary table
2. **scratch/ directory** — Full detailed reports per auditor domain

## Related

- [Audit Command](/commands/audit) — Run individual auditors by domain
- [Memory Auditor](/agents/memory-auditor) — One of the 26 individual auditors health-check orchestrates
```

**Step 2: Add entry to commands index**

Add a row for health-check in the commands index page table.

**Step 3: Run VitePress build to verify**

```bash
npm run docs:build
```

**Step 4: Commit**

```bash
git add docs/commands/health-check.md docs/commands/index.md
git commit -m "docs: add health-check command documentation"
```

---

### Task 6: Rebuild MCP Bundle

**Files:**
- Rebuild: `axiom-mcp/dist/bundle.json`

**Context:**
- After adding a new agent and command, rebuild the MCP bundle
- The bundle is gitignored but needs to be current for MCP server users
- Use `pnpm run build:bundle` (not just `tsc`)

**Step 1: Rebuild**

```bash
cd axiom-mcp && pnpm run build:bundle
```

**Step 2: Verify health-check appears**

```bash
node -e "const b = require('./dist/bundle.json'); console.log(b.skills.filter(s => s.name.includes('health')).map(s => s.name))"
```

**Step 3: No commit needed** (bundle.json is gitignored)

---

### Task 7: Manual Smoke Test

**Context:**
- Test the agent on the Axiom project itself (it has Swift-like files in skills/docs)
- This verifies auto-detection logic works

**Step 1: Run the health check**

```bash
# In Claude Code:
/axiom:health-check
```

**Step 2: Verify output**

Check that:
- Auto-detection correctly identifies which auditors to run
- Auditors launch in parallel
- Results appear in scratch/ directory
- Summary displays in conversation
- No crashes or hangs

**Step 3: Fix any issues found, commit fixes**

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Create agent | `agents/health-check.md` |
| 2 | Create command | `commands/health-check.md` |
| 3 | Add "all" alias | `commands/audit.md` |
| 4 | Register in manifest | `claude-code.json` |
| 5 | Documentation | `docs/commands/health-check.md`, `docs/commands/index.md` |
| 6 | Rebuild MCP bundle | `axiom-mcp/dist/bundle.json` |
| 7 | Smoke test | Manual verification |
