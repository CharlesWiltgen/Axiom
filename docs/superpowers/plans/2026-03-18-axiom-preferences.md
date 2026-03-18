# Axiom Project Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist simulator device and bundle ID in `.axiom/preferences.yaml` so developers don't re-specify them each session.

**Architecture:** Claude reads/writes a YAML file in the project root, guided by instructions added to the xclog-ref skill, console command, and simulator-tester agent. No code changes — only skill/command/agent prompt updates.

**Tech Stack:** YAML file, Claude Write/Read tools, existing xclog binary

**Spec:** `docs/superpowers/specs/2026-03-18-axiom-preferences-design.md`

---

### Task 1: Add preference support to axiom-xclog-ref skill

The xclog-ref skill is the primary place Claude learns how to use xclog. Add preference reading before discovery and preference writing after successful capture.

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-xclog-ref/SKILL.md`

- [ ] **Step 1: Add Preferences section after "Critical Best Practices"**

Insert a new `## Preferences` section after the Critical Best Practices section (after line 43, before `## Commands` at line 45). Content:

```markdown
## Preferences

Axiom saves simulator preferences to `.axiom/preferences.yaml` in the project root. **Check this file before running `xclog list`** — if preferences exist, use the saved device and bundle ID directly.

### Reading Preferences

Before running `xclog list`, read `.axiom/preferences.yaml`:

```yaml
simulator:
  device: iPhone 16 Pro
  deviceUDID: 1A2B3C4D-5E6F-7890-ABCD-EF1234567890
  bundleId: com.example.MyApp
```

If the file exists and contains a `simulator` section, use the saved `deviceUDID` and `bundleId` for xclog commands. Skip `xclog list` unless the user asks for a different app or the saved values fail.

If the file doesn't exist or the `simulator` section is missing, fall back to `xclog list` discovery.

If the saved `deviceUDID` is not found among available simulators (xclog or simctl fails), fall back to discovery and save the new selection.

If the YAML is malformed, warn the developer and fall back to discovery. Do not overwrite a malformed file.

### Writing Preferences

After a successful `xclog launch` or `xclog list` selection, save the device and bundle ID:

1. Read `.axiom/preferences.yaml` if it exists (to preserve other keys)
2. Update the `simulator:` section with `device`, `deviceUDID`, and `bundleId`
3. Write the merged YAML back using the Write tool
4. If `.axiom/` doesn't exist, create it first
5. After creating `.axiom/`, check `.gitignore` — if the file exists, check if any line matches `.axiom/` exactly; if not, append `\n.axiom/\n`. If `.gitignore` doesn't exist, create it with `.axiom/\n` as its content

Example write:

```yaml
simulator:
  device: iPhone 16 Pro
  deviceUDID: 1A2B3C4D-5E6F-7890-ABCD-EF1234567890
  bundleId: com.example.MyApp
```
```

- [ ] **Step 2: Update Critical Best Practices to reference preferences**

Change the line at approximately line 29:

```
**ALWAYS run `list` before `launch` to discover the correct bundle ID.**
```

To:

```
**Check `.axiom/preferences.yaml` first.** If no saved preferences, run `list` before `launch` to discover the correct bundle ID.
```

- [ ] **Step 3: Verify the skill reads coherently**

Read the full modified skill and confirm:
- Preferences section flows naturally after Critical Best Practices
- No contradictions with existing guidance
- The "always run list first" advice now correctly defers to saved preferences

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-xclog-ref/SKILL.md
git commit -m "feat: add preference read/write guidance to xclog-ref skill"
```

---

### Task 2: Add preference support to /axiom:console command

The console command is the primary user-facing entry point for xclog. Add preference reading at the start and preference writing after capture.

**Files:**
- Modify: `.claude-plugin/plugins/axiom/commands/console.md`

- [ ] **Step 1: Update the Steps section**

Replace the existing `## Steps` section with:

```markdown
## Steps

1. Read `.axiom/preferences.yaml` — if it exists and has a `simulator` section, use saved `device`, `deviceUDID`, and `bundleId`
2. If no saved preferences, run `${CLAUDE_PLUGIN_ROOT}/bin/xclog list` to discover installed apps
3. Ask the user which app to capture (or use the saved/specified one)
4. Run `${CLAUDE_PLUGIN_ROOT}/bin/xclog launch <bundle-id> --timeout 30s --max-lines 200`
5. Present the captured output, highlighting errors and faults
6. Save the used device and bundle ID to `.axiom/preferences.yaml` (see `axiom-xclog-ref` skill for write instructions)
```

- [ ] **Step 2: Verify the command reads coherently**

Read the full modified command and confirm:
- Steps flow logically with preference check first
- Fallback to discovery is clear
- Write step references the skill instead of duplicating instructions

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugins/axiom/commands/console.md
git commit -m "feat: add preference support to console command"
```

---

### Task 3: Add preference support to simulator-tester agent

The simulator-tester agent uses `simctl` directly (not xclog) but benefits from knowing the preferred device.

**Files:**
- Modify: `.claude-plugin/plugins/axiom/agents/simulator-tester.md`

- [ ] **Step 1: Add preference check to Mandatory First Steps**

Insert before the existing bash block in the "Mandatory First Steps" section (after line 48 `**ALWAYS run these checks FIRST** (using JSON for reliable parsing):`):

```markdown
**Check for saved preferences first:**

Read `.axiom/preferences.yaml` if it exists. If it contains a `simulator.device` and `simulator.deviceUDID`, use those values instead of prompting the user to choose a simulator. If the saved device isn't booted, boot it by UDID.

If no preferences file exists, proceed with discovery below.
```

- [ ] **Step 2: Add preference write to Test Workflow**

After the existing Test Workflow section (line 261), add a step 7:

```markdown
7. **Save**: If this is a new device/app selection, save to `.axiom/preferences.yaml` (see `axiom-xclog-ref` skill)
```

- [ ] **Step 3: Verify the agent reads coherently**

Read the full modified agent and confirm:
- Preference check comes before simulator discovery
- The existing discovery flow is preserved as fallback
- Write step references xclog-ref for consistency

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/agents/simulator-tester.md
git commit -m "feat: add preference support to simulator-tester agent"
```

---

### Task 4: Verify end-to-end coherence

- [ ] **Step 1: Read all three modified files**

Read and confirm consistency across:
- `.claude-plugin/plugins/axiom/skills/axiom-xclog-ref/SKILL.md`
- `.claude-plugin/plugins/axiom/commands/console.md`
- `.claude-plugin/plugins/axiom/agents/simulator-tester.md`

Verify:
- All three reference the same file path (`.axiom/preferences.yaml`)
- All three use the same schema (`simulator.device`, `simulator.deviceUDID`, `simulator.bundleId`)
- Console command and simulator-tester both defer to xclog-ref for write instructions (no duplication)
- Fallback behavior is consistent (missing file → discovery, malformed → warn + discovery)

- [ ] **Step 2: Run pre-deploy validation**

```bash
deno run --allow-read --allow-run --allow-env scripts/pre-deploy.ts --static
```

- [ ] **Step 3: Final commit if any fixes needed**

If validation caught issues, fix and commit the specific files:
```bash
git add .claude-plugin/plugins/axiom/skills/axiom-xclog-ref/SKILL.md .claude-plugin/plugins/axiom/commands/console.md .claude-plugin/plugins/axiom/agents/simulator-tester.md
git commit -m "fix: address pre-deploy validation issues"
```
