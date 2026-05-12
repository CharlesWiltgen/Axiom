#!/usr/bin/env python3
"""SubagentStart hook for Axiom plugin.

Injects compact Axiom skill awareness into subagents so they use skills.

Standalone Python (matching pretool-crash-route.py / posttool-bash-hints.py /
user-prompt-submit.py) — NOT embedded in a bash heredoc. The heredoc-in-bash
pattern breaks under macOS bash 3.2 whenever a prose apostrophe lands in the
body; plain .py avoids that and is directly lintable/testable.

Reads a JSON payload on stdin, writes a JSON response on stdout. Never exits
non-zero — a hook failure must not block subagent startup.
"""
import json
import sys

try:
    input_data = json.load(sys.stdin)
    agent_type = input_data.get("agent_type", "")
except Exception:
    print("{}")
    sys.exit(0)

# Skip agents that won't benefit from Axiom skills
skip_types = {
    "statusline-setup",
    "claude-code-guide",
    "episodic-memory:search-conversations",
    "beads:task-agent",
    "plugin-dev:skill-reviewer",
    "plugin-dev:plugin-validator",
    "plugin-dev:agent-creator",
    "plugin-dev:skill-development",
    "plugin-dev:command-development",
    "plugin-dev:hook-development",
    "plugin-dev:plugin-structure",
    "plugin-dev:agent-development",
    "plugin-dev:plugin-settings",
    "plugin-dev:mcp-integration",
    "plugin-dev:create-plugin",
    "code-simplifier:code-simplifier",
}

if agent_type in skip_types:
    print("{}")
    sys.exit(0)

# Also skip any agent type containing known non-iOS plugin prefixes
skip_prefixes = ("beads:", "plugin-dev:", "superpowers-lab:", "superpowers-developing-for-claude-code:")
if any(agent_type.startswith(p) for p in skip_prefixes):
    print("{}")
    sys.exit(0)

context = """You have access to Axiom iOS development skills via the Skill tool. If your task involves iOS, Swift, Xcode, or Apple frameworks, invoke the matching skill BEFORE doing the work:

- `axiom-build` — build failures, Xcode, simulator, SPM
- `axiom-swiftui` — SwiftUI views, navigation, layout, animation, architecture
- `axiom-data` — SwiftData, Core Data, CloudKit, migrations, Codable
- `axiom-concurrency` — async/await, actors, Sendable, data races
- `axiom-performance` — memory leaks, profiling, battery, Instruments
- `axiom-networking` — URLSession, Network.framework, HTTP
- `axiom-integration` — widgets, Siri, StoreKit, EventKit, push, background tasks
- `axiom-media` — camera, photos, audio, haptics, ShazamKit, Now Playing
- `axiom-accessibility` — VoiceOver, Dynamic Type, WCAG
- `axiom-ai` — Foundation Models, Apple Intelligence
- `axiom-games` — SpriteKit, SceneKit, RealityKit
- `axiom-shipping` — App Store submission, rejections, privacy manifests
- `axiom-macos` — macOS windows, menus, sandboxing, distribution, AppKit bridging
- `axiom-design` — HIG patterns, Liquid Glass, SF Symbols, typography, app structure
- `axiom-swift` — Swift idioms, noncopyable types, drag and drop, tvOS
- `axiom-uikit` — UIKit/SwiftUI bridging, Auto Layout, Combine, TextKit
- `axiom-location` — Core Location, MapKit, geofencing, directions

Invoke with: Skill tool, skill name (e.g., "axiom-swiftui")."""

output = {
    "hookSpecificOutput": {
        "hookEventName": "SubagentStart",
        "additionalContext": context,
    }
}

print(json.dumps(output))
