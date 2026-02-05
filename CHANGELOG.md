# Axiom — Development Changelog

**Purpose**: Historical record of Axiom development milestones, TDD testing results, and architectural decisions.

**For current context**, see CLAUDE.md

---

## Version History

### v2.20 — MCP Server + Games/3D Skills (2026-02-05)

**Axiom MCP server** — Axiom now includes an [MCP (Model Context Protocol) server](https://charleswiltgen.github.io/Axiom/guide/mcp-install) that brings its iOS development skills to any MCP-compatible AI coding tool — VS Code with GitHub Copilot, Claude Desktop, Cursor, Gemini CLI, and more. The server includes MCP tool annotations (read-only hints, titles) and server-level instructions so MCP clients can discover Axiom's capabilities automatically. Supports BM25 with fuzzy matching and prefix search.

**New 3D and games skill suites**:
- `axiom-spritekit` (discipline) – 2D game architecture, scene graphs, physics, actions, game loops
- `axiom-spritekit-ref` (reference) – Complete SpriteKit API guide with SwiftUI integration
- `axiom-spritekit-diag` (diagnostic) – Troubleshooting rendering, physics, and performance
- `axiom-realitykit` (discipline) – ECS architecture, entity-component patterns, RealityView
- `axiom-realitykit-ref` (reference) – Comprehensive RealityKit API and AR patterns
- `axiom-realitykit-diag` (diagnostic) – Troubleshooting entity loading, physics, and rendering
- `axiom-scenekit` (discipline) – 3D scene graphs, materials, animations, SceneKit migration
- `axiom-scenekit-ref` (reference) – Complete SceneKit API guide
- New `spritekit-auditor` agent automatically scans SpriteKit code for common issues

**Other improvements**:
- Updated `ios-games` and `ios-graphics` routers cover SpriteKit, SceneKit, RealityKit, and display performance

### v2.19 — Agent Skills Standard + Xcode Context (2026-02-03)

**Agent Skills standard compliance** — Axiom is now compatible with the [Agent Skills](https://agentskills.io/) open standard, a portable format for giving AI agents new capabilities. Originally developed by Anthropic, it's now supported by Claude Code, Cursor, Gemini CLI, VS Code, GitHub Copilot, OpenAI Codex, Roo Code, and many others. This means Axiom's iOS development expertise is no longer locked to a single tool. As Agent Skills support rolls out across these products, the same skills you use in Claude Code today will work in whichever AI coding tool you pick up tomorrow.

**Apple documentation access** — Axiom now reads Apple's official for-LLM documentation directly from your local Xcode installation, giving Axiom access to authoritative Apple guidance as well as Axiom's deep superset of agents and skills. Docs are read from your local Xcode install at runtime, so this support is always current.

**Other improvements**:
- New `axiom-swiftui-search-ref` (reference) skill covers foundational SwiftUI search APIs
- Aligned 4 skills with 18 newly documented APIs from WWDC 2025-323 (Build a SwiftUI app with the new design)
- Corrected 10+ API names validated against WWDC transcripts and Apple documentation
- Migrated 129 skill files to Agent Skills spec with `license: MIT` and standardized metadata

### v2.19.4 — Apple Documentation Integration (2026-02-03)
Integrated Apple's Xcode-bundled for-LLM documentation as a content source in the MCP server and Claude Code plugin.

- **20 Apple guides** — Liquid Glass (SwiftUI/UIKit/AppKit/WidgetKit), Foundation Models, Swift 6.2 concurrency, SwiftData class inheritance, Swift Charts 3D, App Intents, StoreKit, and more
- **32 Swift compiler diagnostics** — Actor isolation, Sendable, data races, type system, ownership — with official explanations and code fixes
- **Runtime reading** — Docs read from local Xcode installation, stay current when Xcode updates
- **MCP server integration** — Unified `Skill` interface with `source` tracking ('axiom' | 'apple'), BM25 search with source filter, `[Apple]` tags in catalog
- **New router skill** — `axiom-apple-docs` routes questions to specific Apple doc files
- **Graceful degradation** — Works without Xcode; disable with `AXIOM_APPLE_DOCS=false`
- **Config** — `AXIOM_XCODE_PATH` for custom Xcode path, `AXIOM_APPLE_DOCS` enable/disable

**Files**: `xcode-docs.ts` (Xcode detection + loading), `parser.ts` (`SkillSource`, `parseAppleDoc()`), `dev-loader.ts`/`prod-loader.ts` (Apple docs overlay), `search/index.ts` (source filter), `catalog/index.ts` (Apple doc categories), `tools/handler.ts` (source tags), `config.ts` (env vars), `axiom-apple-docs/SKILL.md` (router), `session-start.sh` (Xcode detection at startup)

### v2.18.1 — Claude Code 2.1.19-2.1.22 Compatibility (2025-01-28)
Verified compatibility with Claude Code 2.1.19-2.1.22. Key findings:

- **All 68 skills are hook-free** — Auto-approve in 2.1.19+ (zero friction for users)
- **Agent skills injection works correctly** — 30 agents properly inject router skills
- **Background agent permissions** — 2.1.20 prompts upfront (UX improvement, not breaking)
- **No breaking changes** — Commands, skills, and agents work unchanged

Audit tasks completed:
1. Skills hook audit — confirmed all skills hook-free
2. Command argument syntax — $0/$1 shorthand not needed (agent-launcher pattern)
3. Agent permissions — read-only agents need no prompts, Bash agents prompt upfront
4. Task deletion feature — not applicable (agents use "scan and report" pattern)

### Agent Skills Injection (2025-01-10)
Added `skills` field to all 26 agents, injecting appropriate router skills into each agent's context. **Critical fix**: Sub-agents do NOT automatically inherit skills from the main conversation — the `skills` field is required to give agents access to Axiom's specialized knowledge.

**Mappings**: Each agent now receives its domain-specific router skill:
- Build/environment agents → `axiom-ios-build`
- UI/SwiftUI agents → `axiom-ios-ui`
- Data/persistence agents → `axiom-ios-data`
- Concurrency agents → `axiom-ios-concurrency`
- Performance agents → `axiom-ios-performance`
- Testing agents → `axiom-ios-testing`
- Networking agents → `axiom-ios-networking`
- Integration agents → `axiom-ios-integration`
- Accessibility agents → `axiom-ios-accessibility`

**Files modified**: All 26 agent files in `.claude-plugin/plugins/axiom/agents/`

**Discovery**: Found via Claude Code 2.1.2/2.1.3 changelog research — official docs confirm sub-agents need explicit `skills` field injection.

### v2.0.0 — Two-Layer Routing Architecture (2025-12-20)
**Major architectural redesign** implementing progressive disclosure pattern inspired by Superpowers 4. Solves the core problem: skills almost never triggered voluntarily. **Root causes addressed**: (1) No discipline injection - SessionStart hook now injects `using-axiom` skill via `additionalContext`, (2) Keyword-based descriptions allowed rationalization - changed to anti-rationalization imperatives ("Use when ANY..."), (3) Too many manifest items (92) overwhelmed system prompt - reduced to 10 routers.

**Architecture**: Two-layer routing with progressive disclosure:
- **Layer 1 (Manifest)**: 10 router skills with broad, anti-rationalization descriptions (ios-build, ios-ui, ios-data, ios-concurrency, ios-performance, ios-networking, ios-integration, ios-accessibility, ios-ai, ios-vision)
- **Layer 2 (Invoked)**: 74 specialized skills invoked by routers based on user request
- **Hook**: SessionStart injects using-axiom discipline skill establishing "check skills BEFORE ANY RESPONSE"
- **Backward compatible**: All 74 specialized skills, 19 agents, 21 commands work unchanged

**Metrics**: Character budget reduced 85% (13,242 → 1,985 chars, 13,015 headroom). Manifest items reduced 89% (92 → 10 routers). Router descriptions average 199 chars with rich anti-rationalization language. **84 total skills** (10 routers + 74 specialized including using-axiom).

**Implementation**: Created session-start.sh hook with `hookSpecificOutput.additionalContext` injection, 10 router skills with decision trees and routing logic, updated claude-code.json to routers-only manifest, updated `.claude/rules/skill-descriptions.md` with router philosophy. Testing documentation in `notes/router-architecture-testing.md`.

**Expected behavior**: Skills trigger proactively via discipline injection + anti-rationalization descriptions, eliminating need for explicit user prompts. Maintains "84 skills" marketing accuracy through intelligent routing. Based on Jesse Vincent's Superpowers 4 pattern and character budget research.

### v1.5.0 — Vision Framework Skills Suite (2025-12-20)
Comprehensive Vision framework skill suite covering people-focused computer vision: **vision** discipline skill (600 lines), **vision-ref** reference skill (900 lines), **vision-diag** diagnostic skill (550 lines). Based on WWDC 2023/10176 "Lift subjects from images in your app", WWDC 2023/111241 "3D body pose and person segmentation", and WWDC 2020/10653 "Detect Body and Hand Pose". **Coverage**: Subject segmentation (VNGenerateForegroundInstanceMaskRequest, VisionKit), hand pose detection (21 landmarks), body pose detection (2D/3D), person segmentation (up to 4 people), face detection, CoreImage integration for HDR compositing. **Key pattern**: Isolating objects while excluding hands (user's original use case) - combines subject mask + hand pose detection + custom masking. **Platform support**: iOS 14+ (hand/body pose), iOS 16+ (VisionKit), iOS 17+ (instance masks, 3D pose). **Token budget**: 14,286 chars total (714 headroom), vision skills: 519 chars combined. Documentation added to `docs/skills/computer-vision/` and `docs/reference/` with new Computer Vision category. **73 total skills** (vision, vision-ref, vision-diag added).

### Manifest Optimization (2025-12-18) — Token Budget Compliance
Rewrote all 86 skill/agent descriptions to comply with Claude Code's 15,000 character system prompt budget. Changed from verbose sentence format to concise comma-separated keyword lists. **Results**: Reduced from 28,499 → 13,242 chars (54% reduction, 1,758 char headroom). Skills averaged 146 chars (down from 324), agents 185 chars (down from 359). Maintained trigger effectiveness by preserving error messages, technical keywords, user symptoms, and framework names. Added `.claude/rules/skill-descriptions.md` with format guidelines and validation scripts. **Impact**: Ensures all skills remain discoverable in Claude Code's system prompt instead of being silently invisible beyond the budget limit. Based on Jesse Vincent's blog post discovering the 15k constraint.

### Skill Update (2025-12-16) — Localization v1.1.0
Updated **localization** reference skill with Xcode 26 type-safe localization patterns from WWDC 2025-225 "Explore localization with Xcode". Added Part 10 covering: generated symbols (compile-time error checking), automatic comment generation (on-device AI), `#bundle` macro (official Swift Package solution), custom table symbol access, two localization workflows (string extraction vs generated symbols), and refactoring tools. Updated System Requirements for Xcode 26+. Primary source: WWDC 2025-225. Supplementary: Daniel Saidi blog post on public wrapper patterns for advanced cross-package scenarios. Skill v1.0.0 → v1.1.0 (260+ lines added). Documentation updated in both skill file and VitePress docs.

### v1.0.3 — Documentation & Command Alignment
Updated documentation to fully align with plugin manifest commands. Added missing documentation pages for 7 commands: `/axiom:ask`, `/axiom:audit`, `/axiom:status`, `/axiom:fix-build`, `/axiom:optimize-build`, `/axiom:audit-swiftui-nav`, and `/axiom:audit-swiftui-performance`. Updated `/commands` index page to include all 18 commands with working links and added missing `audit-textkit` entry.

### v1.0.0 — SwiftUI Architecture Skill (TDD Tested - Grade A+)
Comprehensive SwiftUI architecture skill covering Apple patterns, MVVM, TCA, and Coordinator approaches for iOS 26+. **swiftui-architecture** discipline skill (1,070 lines, Grade A+, full RED-GREEN-REFACTOR testing). Based on WWDC 2025/266, 2024/10150, 2023/10149. Covers State-as-Bridge pattern, @Observable models, property wrapper decision trees (3 questions), MVVM for complex presentation logic, TCA trade-offs analysis, Coordinator patterns for navigation, 4-step refactoring workflow, 5 anti-patterns with before/after code, 3 pressure scenarios, and code review checklist. **TDD Results**: Prevents "refactor later" rationalization under deadline pressure (Scenario 1 flip from FAIL to PASS), resists 9 pressure types (deadline, authority, sunk cost, existential threat, hybrid approaches, pattern purity), prevents both under-extraction AND over-extraction (balanced guidance). Test artifacts in `scratch/swiftui-architecture-test-results.md`. Documentation page at `docs/skills/ui-design/swiftui-architecture.md`. **First v1.0 release - production-ready comprehensive architecture guidance.**

### v0.9.27 — Extensions & Widgets Skills Suite
Comprehensive widget development skills covering iOS 14-18+: **extensions-widgets** discipline skill (900+ lines, Grade A+, 7 anti-patterns with time costs, 3 pressure scenarios including phased push notification strategy, 80% rationalization prevention), **extensions-widgets-ref** reference skill (2250+ lines, 11 parts covering WidgetKit/ActivityKit/Control Center, troubleshooting section with 10 scenarios, "Building Your First Widget" workflow, expert review checklist with 50+ items, complete testing guidance), **apple-docs-research** methodology skill (500+ lines, Chrome WWDC transcript capture technique, sosumi.ai URL patterns, saves 3-4 hours per research task). Based on WWDC 2025/278, 2024/10157, 2024/10068, 2023/10028, 2023/10194. Covers standard widgets, interactive widgets (iOS 17+), Live Activities with Dynamic Island (iOS 16.1+), Control Center widgets (iOS 18+), watchOS integration, visionOS support. Tested by pressure-testing agents with all critical gaps fixed. **43 total skills.**

### v0.9.18 — Now Playing Integration Skill
Comprehensive MediaPlayer framework guide addressing 4 common issues: info not appearing, commands not working, artwork problems, and state sync. Covers both MPNowPlayingInfoCenter (manual) and MPNowPlayingSession (automatic iOS 16+) patterns. Includes 15+ gotchas table, 2 pressure scenarios with professional push-back templates. Based on WWDC 2019/501 and WWDC 2022/110338. 35KB discipline skill for iOS 18+ audio/video apps.

### v0.9.17 — Hybrid Invocation Architecture
Added 8 lightweight command wrappers for all agents: /axiom:fix-build, /axiom:audit-accessibility, /axiom:audit-concurrency, /axiom:audit-memory, /axiom:audit-core-data, /axiom:audit-liquid-glass, /axiom:audit-networking, /axiom:audit-swiftui-performance. Commands are explicit shortcuts that launch agents, complementing natural language triggering. Zero duplication: all logic lives in agents, commands are ~20-line bookmarks. **8 commands + 8 agents for maximum discoverability and UX flexibility.**

### v0.9.16 — SwiftUI Performance Agent
Added **swiftui-performance-analyzer** that automatically scans for performance anti-patterns: expensive operations in view bodies (formatters, I/O, image processing), whole-collection dependencies, missing lazy loading, frequently changing environment values, and missing view identity. Detects the 8 most common SwiftUI performance issues. **8 total agents.**

### v0.9.15 — Agents-Only Architecture
Completed migration from commands to agents. Added **core-data-auditor** (schema migration risks, thread-confinement violations, N+1 queries), **liquid-glass-auditor** (iOS 26 adoption opportunities, toolbar improvements, blur effect migrations), **networking-auditor** (deprecated APIs like SCNetworkReachability, anti-patterns, App Store rejection risks). Removed all 6 audit commands in favor of natural language triggering. **7 total agents now cover all audit needs proactively.**

### v0.9.14 — Quick Win Agents
Three new autonomous agents that proactively scan for common issues: **accessibility-auditor** (VoiceOver labels, Dynamic Type, color contrast, WCAG compliance), **concurrency-validator** (Swift 6 strict concurrency violations, unsafe Task captures, missing @MainActor), **memory-audit-runner** (6 common leak patterns: timers, observers, closures, delegates, view callbacks, PhotoKit). All use haiku model for fast execution.

### v0.9.13 — Autonomous Agents
build-fixer agent automatically diagnoses and fixes Xcode build failures (zombie processes, Derived Data, simulator issues, SPM cache) using environment-first diagnostics. Saves 30+ minutes by running diagnostics and applying fixes autonomously. **First autonomous agent for Axiom!**

### v0.9.12 — Getting Started Skill & SwiftUI Navigation Suite
- **Getting Started Skill**: Interactive onboarding with personalized recommendations, complete skill index, and decision trees
- **SwiftUI Navigation Skills Suite**: swiftui-nav discipline skill (28KB), swiftui-nav-diag diagnostic skill (22KB), swiftui-nav-ref reference skill (38KB) - based on WWDC 2022/10054, 2024/10147, 2025/256, 2025/323, covering NavigationStack, NavigationSplitView, NavigationPath, deep linking, state restoration, Tab/Sidebar integration (iOS 18+), Liquid Glass navigation (iOS 26+), and coordinator patterns

### v0.9.11 — SwiftUI Adaptive Layout Skills
swiftui-layout discipline skill (decision trees for ViewThatFits vs AnyLayout vs onGeometryChange, size class limitations, iOS 26 free-form windows, anti-patterns), swiftui-layout-ref reference (complete API guide). Also added avfoundation-ref (iOS 26+ spatial audio, ASAF/APAC, bit-perfect DAC) and swiftdata-to-sqlitedata migration guide.

### v0.9.1 — SQLiteData Skill Complete Rewrite
Verified against official pointfreeco/sqlite-data repository. Fixed 15 major API inaccuracies (@Column not @Attribute, .Draft insert pattern, .find() for updates/deletes, prepareDependencies setup, SyncEngine CloudKit config). Added 8 missing features (@Fetch, #sql macro, joins, FTS5, triggers, enum support).

### v0.9.0 — Apple Intelligence Skills Suite
foundation-models discipline skill (30KB), foundation-models-diag diagnostic skill (25KB), foundation-models-ref reference skill (40KB) - based on WWDC 2025/286, 259, 301, covering LanguageModelSession, @Generable structured output, streaming with PartiallyGenerated, Tool protocol, dynamic schemas, and all 26 WWDC code examples for iOS 26+

### v0.8.12 — Comprehensive Networking Skills Suite
networking discipline skill (30KB), networking-diag diagnostic skill (27KB), network-framework-ref reference skill (38KB), audit-networking command (~5KB) - based on WWDC 2018/715 and WWDC 2025/250, covering NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency

### v0.8.11 — Naming Convention & Diagnostic Enhancements
Established 3-category naming convention (-diag, -ref, no suffix), added pressure scenarios to diagnostic skills, created audit-core-data command, renamed prescan-memory to audit-memory

### v0.8.10 — Liquid Glass Reference & Skill Updates
Renamed reference skills with `-ref` suffix for clarity (liquid-glass-ref, realm-migration-ref), added liquid-glass-ref comprehensive adoption guide from Apple documentation, updated liquid-glass skill with new iOS 26 APIs

### v0.8.5 — Accessibility Audit
Accessibility audit command and debugging skill - comprehensive WCAG compliance, VoiceOver testing, Dynamic Type support

---

## TDD Testing Methodology

**Superpowers writing-skills TDD framework** applied to 16 skills:
- RED-GREEN-REFACTOR cycles for each skill
- Pressure scenarios: time constraints, authority pressure, sunk cost, deadline effects
- Baseline testing without skill guidance documented
- Verification testing with skill guidance verified improvements
- Loophole identification and closure in REFACTOR phase

### TDD Testing Results Summary
- **16/16 skills**: RED-GREEN-REFACTOR tested
- **Key improvement**: Average issue resolution time reduced by 60-70%
  - Xcode debugging: 30+ min → 2-5 min
  - Memory leaks: 2-3 hours → 15-30 min
  - UIKit animation: 2-4 hours → 5-15 min
  - Block retain cycles: 2-4 hours → 5-15 min
  - SwiftUI architecture: Prevents "refactor later" under deadline pressure

### Critical Findings from TDD Campaign
1. **xcode-debugging**: Time cost transparency prevents 30+ minute rabbit holes
2. **swift-concurrency**: Checklist contradicted pattern, critical fix applied
3. **database-migration**: Multi-layered prevention works under extreme pressure
4. **swiftui-architecture**: Grade A+, prevents both under-extraction AND over-extraction, resists 9 pressure types
5. **All other skills**: Verified to prevent identified rationalizations when tested

### Testing Artifacts

Located in `scratch/` (gitignored):
- **xcode-debugging-test-results.md** — Baseline vs with-skill comparison
- **swift-concurrency-test-results.md** — Checklist contradiction found & fixed
- **database-migration-test-results.md** — Prevented data corruption under pressure
- **swiftui-architecture-test-results.md** — Grade A+ comprehensive architecture guidance (2025-12-14)

---

## Historical Roadmap

### Completed
1. ✅ Test plugin installation
2. ✅ Run VitePress site
3. ✅ Gather feedback from real usage
4. ✅ Add to Claude Code plugin marketplace (submitted to 3 marketplaces)

### Short Term
1. Refine skills based on feedback
2. Create GitHub repository
3. Add LICENSE file (MIT)

### Medium Term
1. Create contribution guidelines
2. TDD testing for remaining discipline skills (networking, now-playing, foundation-models, swiftui-layout, swiftui-nav)
3. Community marketplace reviews and real-world user feedback

---

## Known Issues (Historical)

### None Critical
All production-ready skills are tested and verified.

### Needs Validation
- ui-testing skill (no formal TDD testing yet)
- build-troubleshooting skill (no formal TDD testing yet)

**Action**: Use in real scenarios, gather feedback, refine

---

**Last Updated**: 2025-12-17
**Status**: 68 skills (all in manifest), 18 agents, 20 commands
