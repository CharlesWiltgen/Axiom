# App Store Connect MCP Reference

Reference for using asc-mcp MCP tools to interact with App Store Connect programmatically — worker selection, tool parameters, workflow patterns, and API constraints.

## When to Use This Reference

Use this reference when:
- Looking up specific asc-mcp tool names and parameters
- Choosing which `--workers` preset fits your task
- Troubleshooting asc-mcp tool failures or unexpected behavior
- Understanding API constraints (metadata rules, version states, rate limits)
- Correlating manual ASC actions to their MCP tool equivalents

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What parameters does `app_versions_submit_for_review` take?"
- "Which workers do I need for TestFlight distribution?"
- "Why is `app_versions_attach_build` failing?"
- "What's the asc-mcp tool for responding to reviews?"
- "How do I switch between App Store Connect accounts?"
- "What are the API constraints for version metadata?"

## What's Covered

- 25 workers with their tool groupings and auto-include rules
- 3 worker presets (TestFlight ~34 tools, Release ~40, Monetization ~55)
- 5 workflow patterns: release pipeline, TestFlight distribution, review management, feedback triage, multi-company
- Top 20 tools with parameters organized by category (apps, builds, versions, TestFlight, reviews, metrics)
- API constraints: metadata formatting, version state requirements, JWT lifecycle, rate limiting, locale codes
- Gotchas: build processing delays, version conflicts, Beta App Review, missing analytics
- Multi-company configuration (JSON file and environment variable approaches)
- Fallback workflows when asc-mcp is not available

## Documentation Scope

This page documents the `axiom-asc-mcp` skill — the workflow-focused guide Claude uses when interacting with App Store Connect via asc-mcp MCP tools.

- For manual ASC navigation (crash data, metrics dashboards), see [App Store Connect Reference](/reference/app-store-connect-ref)
- For submission preparation checklists, see [App Store Submission](/skills/shipping/app-store-submission)
- For crash log parsing, use `/axiom:analyze-crash`

## Related

- [App Store Connect Reference](/reference/app-store-connect-ref) — Manual ASC navigation when MCP is not available
- [TestFlight Crash Triage](/skills/debugging/testflight-triage) — Xcode Organizer crash workflows, complemented by asc-mcp's programmatic diagnostics
- [Xcode MCP Integration](/skills/xcode-mcp/) — Similar MCP tool integration pattern for Xcode IDE tools

## Resources

**GitHub**: zelentsov-dev/asc-mcp

**Docs**: /appstoreconnectapi
