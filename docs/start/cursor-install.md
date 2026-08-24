# Cursor Plugin

Axiom's native Cursor plugin packages <!--ax:routers-->27<!--/ax--> skill routers, <!--ax:agents-->42<!--/ax--> agents, <!--ax:commands-->17<!--/ax--> `/axiom-*` commands, advisory hooks, and plugin-root MCP configuration for the separately distributed `axiom-mcp` package resolved through `npx` on Cursor IDE/Desktop for macOS.

The plugin is a generated distribution. Contributors should change the canonical Axiom source or `scripts/cursor/render.ts`, run `npm run build:cursor`, and commit the deterministic output rather than editing `axiom-cursor/` directly.

## Support Target and Prerequisites

- **Cursor IDE/Desktop on macOS.** Other operating systems and Cursor products are not part of the verified support target.
- **Node.js 18 or newer.** The plugin's root `mcp.json` launches `npx -y axiom-mcp`.
- **Python 3.** Cursor invokes the shipped advisory hook adapters as Python source.
- **Apple development tools as needed.** Individual Axiom workflows may require Xcode or Apple command-line tools, but they are not bundled by this plugin.
- **A Cursor plan that allows named models, to use the agents.** Cursor Free restricts model selection to Auto and refuses subagent delegation with `Named models unavailable. Free plans can only use Auto.` Skills, commands, hooks, and MCP work on Free; the <!--ax:agents-->42<!--/ax--> agents do not run there.

The generated plugin contains Markdown, JSON, Python source, and static assets. It ships no compiled or executable binary payload. The npm-resolved MCP runtime is a separate dependency and may need network access on first use.

This support target does not include Cursor Cloud Agents. In particular, Axiom does not claim that Cursor Cloud loads this plugin or runs its hooks or local MCP command.

## Install

### Cursor Marketplace

Marketplace installation is available only after the upstream Axiom maintainers publish a reviewed release and Cursor accepts the listing. This repository is a submission candidate; these instructions do not claim that submission or acceptance has occurred.

After an upstream listing exists, install **Axiom** from Cursor's plugin marketplace, review its components and requested behavior, and continue with [Verify the Installation](#verify-the-installation).

### Local Checkout

Clone Axiom to a stable absolute path and check out the revision you intend to test.

In Cursor:

1. Open **Customize** and choose **Add → From Local Repo**.
2. Select the Axiom repository root — the directory containing `.cursor-plugin/marketplace.json` — and choose **Add Plugins**. Do not select `axiom-cursor/` directly.
3. Open **Browse Marketplace**. Under **Axiom Cursor Marketplace**, choose **Add** for Axiom.

Cursor imports the local marketplace into its plugin cache; it does not follow later checkout changes automatically. After pulling a different revision or running `npm run build:cursor`, uninstall Axiom, remove **Axiom Cursor Marketplace**, and repeat the local-repository flow before testing the new bytes.

## Verify the Installation

Open Cursor's **Customize** panel and inspect the Axiom plugin. Confirm that the panel shows the expected plugin version and discovers:

- <!--ax:routers-->27<!--/ax--> skills
- <!--ax:agents-->42<!--/ax--> agents
- <!--ax:commands-->17<!--/ax--> commands in the `/axiom-*` namespace
- native hooks
- the `axiom` MCP server

Try a command such as `/axiom-status` or `/axiom-ask`. Axiom's Cursor command names use a hyphen after `axiom`; the Claude-style `/axiom:*` namespace does not apply here.

The plugin root is `axiom-cursor/`. Cursor automatically discovers `axiom-cursor/mcp.json`; the plugin and marketplace manifests intentionally do not duplicate the MCP definition.

## Agent Authority

The released plugin has two agent classes:

| Class | Count | Behavior |
| --- | ---: | --- |
| Read-only/background | 30 | Declared read-only and eligible to run in the background. |
| Writable/foreground | 12 | Runs in the foreground because it may use write, edit, shell, or delegation capabilities. |

The canonical `screenshot-validator` is writable and is deliberately forced into the foreground for the Cursor release.

Agent delegation depends on the Cursor plan. On Cursor Free every delegation fails before the agent starts, so the plugin's agents register and appear in the picker but cannot run. Verified on Cursor 3.17.8: the plugin's <!--ax:agents-->42<!--/ax--> agents load, and delegation returns `Named models unavailable. Free plans can only use Auto.` regardless of an agent's `model` field.

Cursor does not provide Axiom's canonical per-agent tool allowlists. Every generated agent inherits host tool and MCP access that may be broader than its source declaration. Before delegating, review the agent, Cursor's tool approvals, and the MCP allowlist/blocklist. `readonly`, prompts, and advisory hooks reduce accidental scope; they are not substitutes for an enforced sandbox or user approval. Writable agents can change the shared checkout.

## Hooks

The plugin registers supported Cursor hooks for session start, prompt submission, subagent start, file reads, and post-tool shell/write events. They add routing hints or diagnostics as `additional_context` where available.

- The subagent hook adds Axiom skill awareness when a subagent starts, alongside the per-agent Required Skills preamble in the agent file. The hook is confirmed to fire and receive the subagent type; whether its context reaches the subagent has not been verified, because a Cursor plan that refuses to start subagents cannot demonstrate it. If it does not, the preamble still carries each agent's declared skills.
- The read hook routes crash reports. Opening an `.ips`, legacy `.crash`, or `.xccrashpoint` path adds a note pointing at the `axiom_xcsym_crash` MCP tool instead of reading the raw file. It emits no `permission` field, so it never gates the read.
- The prompt hook is the per-prompt router. Cursor's `beforeSubmitPrompt` supplies the prompt text and accepts `additional_context`, so Axiom's canonical routing carries over: a prompt that matches a router is annotated with the skill to invoke before the model answers. It stays silent outside an Apple project and on prompts under five characters.

- Hooks are advisory and fail open on malformed input, missing files, child failure, oversized output, or timeout.
- The write hook runs after the edit. Its findings do not block or undo the change.
- No hook is a permission boundary, and no emitted hook uses fail-closed behavior.
- Hook scripts are non-executable Python source invoked through `python3`.

- Plugin-supplied hooks load behind a Cursor feature gate (`enable_cc_plugin_import`). It is enabled by default, but Cursor controls it remotely, and when it is off Cursor clears plugin hooks silently rather than reporting an error.

If Python 3 is unavailable, plugin content can still appear, but the advisory hook behavior cannot run. Because hooks fail open and the feature gate is silent, absent hook context never means a check passed.

## MCP Behavior

Cursor discovers the plugin-root `mcp.json` automatically and launches:

```text
npx -y axiom-mcp
```

Do not add a second Axiom definition in workspace `.cursor/mcp.json` while the native plugin is installed. Duplicate definitions can produce duplicate servers or make configuration ownership unclear. For a standalone MCP-only setup, use the exact configuration in the [MCP setup guide](/start/mcp-install).

`npx -y` resolves the separately published npm package and suppresses npm's install confirmation; it does not bypass Cursor's MCP approvals or allowlist/blocklist. First launch may need network access. A cached launch may work offline, but that behavior depends on the local npm cache and must not be assumed. Review the resolved package version and exposed tools before approving use.

## Updating and Removing

For a marketplace installation, use Cursor's plugin management UI and follow the upstream release notes.

For a local checkout, uninstall Axiom in **Customize**, then open **Browse Marketplace**, use **Axiom Cursor Marketplace → Remove**, and confirm the source repository is unaffected. Do not delete the checkout as part of plugin removal.

## Troubleshooting

### Axiom is missing from Customize

- Confirm you selected the Axiom repository root, not `axiom-cursor/`, in **Add → From Local Repo**.
- Confirm the repository root contains `.cursor-plugin/marketplace.json` and its Axiom source is `./axiom-cursor`.
- Confirm `axiom-cursor/.cursor-plugin/plugin.json` exists.
- If the checkout changed after installation, remove the cached local marketplace and add it again.

### Skills, agents, or commands are incomplete

- Compare the panel with the expected 27/42/17 inventory.
- Run `npm run check:cursor` from the Axiom checkout to detect stale generated output.
- If check mode reports drift, regenerate with `npm run build:cursor` and inspect the complete delta before reloading Cursor.

### Agents appear but will not run

- Confirm the Cursor plan allows named models. Cursor Free refuses delegation with `Named models unavailable. Free plans can only use Auto.`
- Confirm the agent appears in the picker. Registration and delegation fail independently: an agent can load and still be unable to start.
- Registration is verifiable without running an agent by comparing the picker against the expected <!--ax:agents-->42<!--/ax-->.

### Hooks do not add context

- Run `python3 --version` and confirm Cursor can find the same `python3` executable.
- Treat absent hook context as a diagnostic problem, not proof that a safety check passed.
- Confirm the plugin itself loaded. Cursor's `enable_cc_plugin_import` gate can disable plugin hooks without surfacing an error, leaving skills and commands working while hooks are silently inert.
- Report sanitized hook diagnostics; never include source code, secrets, personal paths, or MCP credentials unnecessarily.

### MCP does not start

- Run `node --version` and confirm Node.js 18 or newer.
- Check Cursor's MCP approval and allowlist/blocklist state.
- Check whether first launch can reach npm and whether the requested package version resolved.
- Remove any duplicate Axiom entry from `.cursor/mcp.json` after reviewing which definition should remain.
- Use the [MCP setup guide](/start/mcp-install) for server-level diagnostics.

## Support Boundaries

Report reproducible native-plugin issues in the [upstream Axiom issue tracker](https://github.com/CharlesWiltgen/Axiom/issues) with the Axiom version, Cursor build, macOS version, architecture, Node and Python versions, install method, and sanitized logs.

Upstream Axiom issue triage covers the generated plugin content, adapters, and documentation. Cursor Marketplace review or acceptance, Cursor behavior outside the documented macOS IDE/Desktop target, Cursor Cloud Agents, npm registry availability, third-party MCP policy, local machine policy, and Apple toolchain failures remain controlled by their respective providers or environments.
