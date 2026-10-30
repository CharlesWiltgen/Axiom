# Pi Coding Agent

Axiom installs into [Pi](https://pi.dev/) — the minimal, open-source terminal coding agent — with one native command that delivers its skills, its `/axiom-*` commands, and its hooks. Pi runs the same `SKILL.md` skills Axiom ships in Claude Code, so the expertise carries over with no conversion.

## What You Get

Axiom's full skill catalog — <!--ax:skills-->286<!--/ax--> skills covering:

- **SwiftUI** – layout, navigation, animations, performance, architecture, debugging
- **Data** – SwiftData, Core Data, GRDB, CloudKit, migrations, Codable
- **Concurrency** – Swift 6, actors, Sendable, async/await, synchronization
- **Performance** – memory leaks, profiling, energy, Instruments workflows
- **Networking** – URLSession, Network.framework, connection diagnostics
- **Build** – Xcode debugging, code signing, build optimization, SPM
- **Integration** – StoreKit, widgets, push notifications, camera, contacts, haptics
- **Apple Intelligence** – Foundation Models, on-device AI, CoreML
- **Accessibility** – VoiceOver, Dynamic Type, WCAG compliance

Pi keeps only the router *descriptions* in context and loads each router's full instructions — and the <!--ax:skills-->286<!--/ax--> skills beneath them — on demand ([progressive disclosure](https://pi.dev/docs/latest/skills)). That's the same two-layer routing Axiom is built around, so the catalog costs few tokens.

## Prerequisites

You need Pi itself ([pi.dev](https://pi.dev/)), plus **git** for `pi install` or **Node.js 18+** for the `npx skills` alternative.

## Installation

### pi install (recommended)

```bash
pi install git:github.com/CharlesWiltgen/Axiom
```

Pi clones the repo, reads its `pi` manifest (`pi.skills` and `pi.extensions`), and loads Axiom's **router skills** plus the **axiom-pi extension**, which adds the `/axiom-*` commands and the hooks. There's no build step: Pi runs the extension's TypeScript directly.

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

This installs the **skills only**, without the commands or hooks. [skills.sh](https://skills.sh/) is a cross-agent installer that also targets Codex, Cursor, and Claude Code, so reach for it when you want one workflow across assistants, or just the skills. `-a pi` targets Pi; `-g` is global (omit it for a project-scoped `.pi/skills/` you can commit). To add the commands and hooks on top, see [Commands and Hooks](#commands-and-hooks).

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

Pi discovers every router `SKILL.md` file recursively from this one path. Run `cd ~/Axiom && git pull` to update.

## Commands and Hooks

The recommended `pi install` already includes the **axiom-pi** extension. (The `npx skills` and manual paths are skills-only; if you used one, add the extension by symlinking the repo's `axiom-pi/` into Pi's extensions directory — `ln -s ~/Axiom/axiom-pi ~/.pi/agent/extensions/axiom-pi` — or switch to `pi install`.)

It adds:

- **Commands** – `/axiom-fix-build`, `/axiom-audit <area>`, `/axiom-health-check`, `/axiom-analyze-crash`, `/axiom-profile`, `/axiom-console`, `/axiom-ui`, and 8 more. Each runs the matching skill in your current session.
- **Session guardrail** – Injects the same iOS and Xcode version facts Axiom gives Claude Code and Codex, naming the Xcode you've switched to (so your assistant never claims a newer iOS "doesn't exist"), and lists which Axiom tools are on your `PATH`. It runs only in Apple projects; override that with `AXIOM_SESSION_CONTEXT=always` or `never` (see [Non-Apple Projects](/start/install#non-apple-projects)).
- **Tool hooks** – On Swift writes, flags `@State` without an access level and SwiftData to-many relationships without a default; routes crash-file reads to `xcsym`; and suggests skills based on command output. They also run only in Apple projects, with the same override.

## Command-Line Helpers

Axiom's optional command-line helpers are `axbuild` (build and test diagnostics), `xcproject` (project inspection), `xclog` (console capture), `xcsym` (crash symbolication), `xcui` (simulator UI and accessibility), and `xcprof` (performance traces). They're prebuilt binaries for Apple Silicon Macs, and no Pi install method puts them on your `PATH`. Clone the repo (skip that line if you already have `~/Axiom`) and symlink them:

```bash
cd ~ && git clone https://github.com/CharlesWiltgen/Axiom.git
ln -sf ~/Axiom/.claude-plugin/plugins/axiom/tools/* /usr/local/bin/
```

If `/usr/local/bin` doesn't exist yet, create it first with `sudo mkdir -p /usr/local/bin`. If `ln` reports a permission error, run it with `sudo`.

Once `axbuild` is on your `PATH`, Axiom's Pi extension lists it at session start and your assistant runs builds and tests through it, so the full log and report are saved. Without it, your assistant saves build output to a log file instead. See [Tools](/tools/).

With the binaries available, ask Pi to "capture the simulator console" or "symbolicate this crash" (the `axiom-tools` skill), or "build the app and show me the first error" (the `axiom-build` skill), and the skill drives the right helper.

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

If you linked the command-line helpers from the plugin's old `bin/` folder, run the `ln -sf` line under [Command-Line Helpers](#command-line-helpers) again after you pull. The helpers now live in `tools/`, so the old links no longer resolve.

## Removing

```bash
pi remove git:github.com/CharlesWiltgen/Axiom   # if you used pi install
npx skills remove -a pi -g                       # if you used npx skills
```

## Differences from Claude Code

Pi consumes Axiom's skills natively, and `pi install` adds the [commands and hooks](#commands-and-hooks) via the axiom-pi extension. The one thing it can't match is Claude Code's autonomous, parallel agents — Pi has no sub-agent system.

| Feature | Claude Code | Pi |
|---------|-------------|----|
| Skills | Full catalog | Full catalog — the routers load the <!--ax:skills-->286<!--/ax--> skills on demand |
| Agents | <!--ax:agents-->43<!--/ax--> autonomous auditors | Not supported — Pi has no sub-agent system |
| Commands | <!--ax:commands-->17<!--/ax--> `/axiom:*` commands | `/axiom-*` — included with `pi install` |
| Hooks | Session + tool hooks | Included with `pi install` |
| Built-in tools | Bundled; Axiom's session hook puts them on `PATH` | Run through Pi's shell once you add them to your `PATH` (see above) |
| Installation | `/plugin marketplace add` | `pi install git:…/Axiom` (or `npx skills … -a pi` for skills only) |

The audits those agents run (memory leaks, concurrency, Core Data safety, and so on) still work as skills — ask Pi to "audit my code for memory leaks", or use `/axiom-audit memory`. They run one at a time in your session, rather than in parallel with their own context as Claude Code's agents do.

## Troubleshooting

### Skills or commands not appearing in Pi

- Run `pi list` (for `pi install`) or `npx skills list -g` (for `npx skills`) to verify what's installed.
- Confirm Pi is reading the location: global skills live in `~/.pi/agent/skills/` (or `~/.agents/skills/`); project skills in `.pi/skills/` (or `.agents/skills/`). Project resources load only after you trust the directory.
- If the `/axiom-*` commands are missing, you installed skills only — add the extension (see [Commands and Hooks](#commands-and-hooks)).

### A skill's instructions never load

Pi loads full instructions on demand. If a match isn't triggering, name the skill explicitly with `/skill:axiom-<name>`.

## Also Available

- **[Claude Code](/start/install)** – Full Axiom experience with <!--ax:agents-->43<!--/ax--> autonomous agents and <!--ax:commands-->17<!--/ax--> commands
- **[Claude App](/start/claude-app-install)** – Skills in chat, plus agents and hooks in Cowork
- **[Codex Plugin](/start/codex-install)** – Native skills for the OpenAI Codex CLI, web app, and IDE extensions
- **[Cursor Plugin](/start/cursor-install)** – Native skills, agents, commands, and hooks for Cursor on macOS
- **[MCP Server](/start/mcp-install)** – Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** – Axiom's skills inside Xcode's Claude Agent and Codex, through MCP
