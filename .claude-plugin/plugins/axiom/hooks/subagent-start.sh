#!/usr/bin/env bash
# SubagentStart hook for Axiom plugin
# Injects compact Axiom skill awareness into subagents so they use skills
# Note: Avoiding 'set -euo pipefail' for robustness

input_json=$(cat)

python3 - "$input_json" <<'PYTHON_SCRIPT'
import json
import sys

try:
    input_data = json.loads(sys.argv[1])
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

Invoke with: Skill tool, skill name (e.g., "axiom-swiftui")."""

output = {
    "hookSpecificOutput": {
        "hookEventName": "SubagentStart",
        "additionalContext": context
    }
}

print(json.dumps(output))
PYTHON_SCRIPT

exit 0
