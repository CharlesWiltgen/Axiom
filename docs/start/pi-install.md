# Pi Coding Agent

Axiom installs into [Pi](https://pi.dev/) — the minimal, open-source terminal coding agent — with one native command that delivers its skills, its `/axiom-*` commands, and its hooks. Pi runs the same `SKILL.md` skills Axiom ships in Claude Code, so the expertise carries over with no conversion.

## What You Get

Axiom's full skill catalog — <!--ax:skills-->254<!--/ax--> skills covering:

- **SwiftUI** – layout, navigation, animations, performance, architecture, debugging
- **Data** – SwiftData, Core Data, GRDB, CloudKit, migrations, Codable
- **Concurrency** – Swift 6, actors, Sendable, async/await, synchronization
- **Performance** – memory leaks, profiling, energy, Instruments workflows
- **Networking** – URLSession, Network.framework, connection diagnostics
- **Build** – Xcode debugging, code signing, build optimization, SPM
- **Integration** – StoreKit, widgets, push notifications, camera, contacts, haptics
- **Apple Intelligence** – Foundation Models, on-device AI, CoreML
- **Accessibility** – VoiceOver, Dynamic Type, WCAG compliance

Pi keeps only the 27 router *descriptions* in context and loads each skill's full instructions — and the <!--ax:skills-->254<!--/ax--> skills beneath them — on demand ([progressive disclosure](https://pi.dev/docs/latest/skills)). That's the same two-layer routing Axiom is built around, so the catalog stays cheap on tokens.

## Prerequisites

You already have Pi (this is a Pi install guide — if not, grab it at [pi.dev](https://pi.dev/)). The commands below also need **git** (for `pi install`) or **Node.js 18+** (for the `npx skills` alternative).

## Installation

### pi install (recommended)

```bash
pi install git:github.com/CharlesWiltgen/Axiom
```

One command, everything. Pi clones the repo, reads its `pi` manifest (`pi.skills` + `pi.extensions`), and loads the **27 skills** plus the **axiom-pi extension** — the `/axiom-*` commands and the hooks. There's no build step (Pi runs the extension's TypeScript directly) and no npm package to publish.

For the current project only:

```bash
pi install git:github.com/CharlesWiltgen/Axiom -l
```

::: tip Verifying Installation
Run `pi list` to see the installed package. Inside Pi, type `/` — you'll see both the `/skill:axiom-*` skills and the `/axiom-*` commands.
:::

### npx skills (cross-agent alternative)

```bash
npx skills add CharlesWiltgen/Axiom -a pi -g
```

This installs the **27 skills only** — no commands or hooks. It's the same [skills.sh](https://skills.sh/) installer Codex, Cursor, and Claude Code use, so reach for it when you want one cross-agent workflow or just the skills. `-a pi` targets Pi; `-g` is global (omit it for a project-scoped `.pi/skills/` you can commit). To add the commands and hooks on top, see [Commands and Hooks](#commands-and-hooks).

### Manual (clone and point Pi at the skills)

To run from a checkout, clone the repo and point Pi at the skills directory:

```bash
cd ~ && git clone https://github.com/CharlesWiltgen/Axiom.git
```

Pass it per-session with the repeatable `--skill` flag:

```bash
pi --skill ~/Axiom/.claude-plugin/plugins/axiom/skills
```

…or make it permanent in your Pi settings:

```json
{
  "skills": ["~/Axiom/.claude-plugin/plugins/axiom/skills"]
}
```

Pi discovers each of the 27 router `SKILL.md` files recursively from this one path. Run `cd ~/Axiom && git pull` to update.

## Commands and Hooks

The recommended `pi install` already includes the **axiom-pi** extension. (The `npx skills` and manual paths are skills-only; if you used one, add the extension by symlinking the repo's `axiom-pi/` into Pi's extensions directory — `ln -s ~/Axiom/axiom-pi ~/.pi/agent/extensions/axiom-pi` — or switch to `pi install`.)

It adds:

- **Commands** – `/axiom-fix-build`, `/axiom-audit <area>`, `/axiom-health-check`, `/axiom-analyze-crash`, `/axiom-profile`, `/axiom-console`, `/axiom-ui`, and 8 more. Each triggers the matching skill inline.
- **Session guardrail** – injects the iOS/Xcode version ground truth (so the agent never claims iOS 26 "doesn't exist") and lists which Axiom tools are on your PATH. Gated to Apple projects; override with `AXIOM_SESSION_CONTEXT=always|never`.
- **Tool hooks** – runs `swiftformat` on Swift writes, flags `@State` without an access level, routes crash-file reads to `xcsym`, and surfaces skill hints from command output.

## Built-in Tools (xclog, xcsym, xcui, xcprof)

Axiom ships four command-line tools — `xclog` (console capture), `xcsym` (crash symbolication), `xcui` (simulator UI/accessibility), and `xcprof` (performance traces). They're prebuilt binaries, and no install method puts them on your `PATH` automatically. Clone the repo and symlink them:

```bash
cd ~ && git clone https://github.com/CharlesWiltgen/Axiom.git
ln -sf ~/Axiom/.claude-plugin/plugins/axiom/bin/* /usr/local/bin/
```

With the binaries available, ask Pi to "capture the simulator console" or "symbolicate this crash" and the `axiom-tools` skill (plus the extension's session hook) will drive them.

## Usage

Skills activate automatically based on your questions. Just ask:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
```

To force a specific skill, invoke it as a command — Pi registers every skill as `/skill:<name>`, and the extension adds the `/axiom-*` commands:

```
/skill:axiom-build
/axiom-fix-build
/axiom-audit memory
```

## Updating

```bash
pi update          # if you used pi install
npx skills update  # if you used npx skills
```

For the manual method, run `cd ~/Axiom && git pull`.

## Removing

```bash
pi remove git:github.com/CharlesWiltgen/Axiom   # if you used pi install
npx skills remove -a pi -g                       # if you used npx skills
```

## Differences from Claude Code

Pi consumes Axiom's skills natively, and `pi install` adds the [commands and hooks](#commands-and-hooks) via the axiom-pi extension. The one thing it can't match is Claude Code's autonomous, parallel agents — Pi has no sub-agent system.

| Feature | Claude Code | Pi |
|---------|-------------|----|
| Skills | Full catalog | 27 routers — the full <!--ax:skills-->254<!--/ax--> skills, loaded on demand |
| Agents | <!--ax:agents-->40<!--/ax--> autonomous auditors | Not supported — Pi has no sub-agent system |
| Commands | <!--ax:commands-->15<!--/ax--> `/axiom:*` commands | `/axiom-*` — included with `pi install` |
| Hooks | Session + tool hooks | Included with `pi install` |
| Built-in tools | Bundled on the plugin's PATH | Run via Pi's shell once added to your PATH (see above) |
| Installation | `/plugin marketplace add` | `pi install git:…/Axiom` (or `npx skills … -a pi` for skills only) |

The audits those agents run (memory leaks, concurrency, Core Data safety, and so on) still run as skills — ask Pi to "audit my code for memory leaks", or use `/axiom-audit memory`. What Pi can't replicate is the parallel, isolated-context fan-out Claude Code's agents provide.

## Troubleshooting

### Skills or commands not appearing in Pi

- Run `pi list` (for `pi install`) or `npx skills list -g` (for `npx skills`) to verify what's installed.
- Confirm Pi is reading the location: global skills live in `~/.pi/agent/skills/` (or `~/.agents/skills/`); project skills in `.pi/skills/` (or `.agents/skills/`). Project resources load only after you trust the directory.
- If the `/axiom-*` commands are missing, you installed skills only — add the extension (see [Commands and Hooks](#commands-and-hooks)).

### A skill's instructions never load

Pi loads full instructions on demand. If a match isn't triggering, name the skill explicitly with `/skill:axiom-<name>`.

## Also Available

- **[Claude Code](/start/install)** – Full Axiom experience with <!--ax:agents-->40<!--/ax--> autonomous agents and <!--ax:commands-->15<!--/ax--> commands
- **[Codex Plugin](/start/codex-install)** – Native skills for the OpenAI Codex CLI, web app, and IDE extensions
- **[MCP Server](/start/mcp-install)** – Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** – Direct Xcode MCP bridge for in-editor assistance
