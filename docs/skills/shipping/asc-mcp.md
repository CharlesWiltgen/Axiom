# App Store Connect MCP

Teaches Claude how to use [asc-mcp](https://github.com/zelentsov-dev/asc-mcp) — an open-source MCP server that exposes the entire App Store Connect API (~208 tools) as MCP tools. Submit builds, distribute to TestFlight, respond to reviews, and monitor metrics without leaving Claude Code.

## When to Use

Use this skill when:
- Setting up asc-mcp for the first time
- Submitting a build to the App Store programmatically
- Distributing builds to TestFlight groups via MCP tools
- Responding to App Store reviews from Claude Code
- Triaging TestFlight crash diagnostics via API
- Managing multiple App Store Connect accounts
- Choosing which `--workers` preset to use

## Example Prompts

- "How do I set up asc-mcp with Claude Code?"
- "Submit build 42 to the App Store"
- "Distribute this build to my beta testers"
- "Respond to all 1-star reviews from this week"
- "Show me crash diagnostics for my latest TestFlight build"
- "Switch to my client's App Store Connect account"
- "Which workers should I load for TestFlight distribution?"
- "Create a new version 2.1.0 and attach the latest build"

## What This Skill Provides

- **Setup guide** — Install via Mint, create API keys, configure Claude Code
- **Worker filtering** — 3 presets (TestFlight, Release, Monetization) to reduce context overhead from 208 tools to 34-55
- **5 workflow patterns** — Release pipeline, TestFlight distribution, review management, feedback triage, multi-company
- **Key tool reference** — Top 20 most-used tools with parameters organized by category
- **API constraints** — No emoji in metadata, version state requirements, JWT auto-refresh, rate limits
- **Gotchas table** — Build processing delays, version conflicts, Beta App Review requirements
- **Fallback guidance** — What to do when asc-mcp is not configured

## Requirements

- **macOS 14+**
- **App Store Connect API key** (Admin or App Manager role)
- **Mint** (`brew install mint`) for installation
- **asc-mcp 1.4.0+** (`mint install zelentsov-dev/asc-mcp@1.4.0`)

## Related

- [App Store Submission](/skills/shipping/app-store-submission) — Pre-flight checklist for preparing submissions — use this skill for the submission preparation workflow, asc-mcp for the programmatic execution
- [App Store Connect Reference](/reference/app-store-connect-ref) — Manual ASC navigation for crash data and metrics — use when asc-mcp is not configured
- [TestFlight Crash Triage](/skills/debugging/testflight-triage) — Xcode Organizer workflows for crash investigation — asc-mcp adds programmatic crash diagnostics access
- [Xcode MCP Integration](/skills/xcode-mcp/) — Similar pattern for Xcode's built-in MCP tools — asc-mcp extends programmatic access to App Store Connect
