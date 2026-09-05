# Axiom for Cursor

A native Cursor plugin for modern Apple platform development, generated from Axiom 27.0.0-beta.53.

## Included

- 27 skill routers
- 42 agents
- 17 `/axiom-*` commands
- Advisory session, shell, and post-write hooks
- Automatic plugin-root MCP discovery
- 30 generated mirrors intentionally excluded

## Requirements and Support

The supported target is Cursor IDE/Desktop on macOS. Node.js 18 or newer is required for the MCP server, and Python 3 is required for the advisory hook adapters. This plugin makes no Cursor Cloud support claim.

The generated plugin tree contains source and static assets but no compiled or executable binary payloads. Its root `mcp.json` launches the separately distributed `axiom-mcp` npm package with `npx -y axiom-mcp`; first use may require network access, package resolution, and Cursor approval.

## Install a Local Checkout

Clone Axiom to a stable absolute path and check out the revision you intend to test.

1. Open Cursor's Customize panel and choose **Add → From Local Repo**.
2. Select the Axiom repository root—the directory containing `.cursor-plugin/marketplace.json`—and choose **Add Plugins**.
3. Under **Axiom Cursor Marketplace**, choose **Add** for Axiom.

Cursor imports the local marketplace into its plugin cache; it does not follow later checkout changes automatically. After changing revisions or regenerating `axiom-cursor/`, uninstall Axiom, remove **Axiom Cursor Marketplace**, and repeat the local-repository flow before testing.

Open Cursor's Customize panel and verify Axiom's version plus all 27 skills, 42 agents, 17 commands, hooks, and MCP server before relying on the installation.

## Authority and Hooks

The released profile has 30 read-only/background agents and 12 writable/foreground agents. Cursor agents inherit host tool and MCP access that may be broader than their canonical Axiom tool lists. Review the agent, tool approvals, and MCP allowlist before running it; prompt instructions and hooks are not security boundaries. Writable agents run in the foreground and may change the shared checkout.

Hooks add routing or diagnostic context after supported events. They are advisory, fail open, and do not enforce permissions or undo an edit that already happened.

## Troubleshooting and Support

If components are missing, confirm you selected the Axiom repository root, `.cursor-plugin/marketplace.json` points to `./axiom-cursor`, and the installed local marketplace was refreshed after the checkout changed. If hooks are absent, confirm `python3` is available. If MCP fails, confirm Node.js 18+ and review Cursor's MCP approval, allowlist/blocklist, and network state. Do not add a duplicate `.cursor/mcp.json` entry when using the plugin.

See the [Cursor install and support guide](https://charleswiltgen.github.io/Axiom/start/cursor-install) or [open an upstream Axiom issue](https://github.com/CharlesWiltgen/Axiom/issues) with sanitized diagnostics. Cursor Marketplace acceptance, non-macOS behavior, Cloud Agents, npm availability, Xcode/toolchain failures, and third-party MCP policy are outside the documented Axiom plugin support boundary.

This directory is generated. Edit the canonical Axiom source or `scripts/cursor/render.ts`, then run `npm run build:cursor`; do not edit generated files directly.
