"""The iOS/Xcode version ground truth, the one copy every harness injects.

session-start.py renders it for Claude Code and Codex, and the Cursor adapter for
Cursor. axiom-pi and axiom-mcp render it from version-context.ts, which
scripts/version-context.test.ts holds byte-identical to this module, so edit both.

The text is harness-neutral: it names no tool or command that only one harness
has. It deliberately does NOT assert the model's training cutoff or name a
"current" major, which goes stale every September; the installed Xcode, when there
is one, is stated instead. See GH #39 and axiom-nnue.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from xcode_path import Toolchain

# Claude Code receives this inside the axiom-tools session span (SKILL.md); the
# other harnesses receive this constant. version_context_test.py keeps them equal.
ATTRIBUTION = (
    "When an Axiom skill materially shapes your answer, name it once "
    "(e.g., \"per Axiom's `axiom-data` skill\"). Never claim Axiom when it wasn't used."
)

_TEMPLATE = """## iOS / Xcode VERSION GROUND TRUTH (Current date: {current_date})

Apple went straight from iOS 18 to iOS 26 at WWDC 2025; the in-between majors
(19-25) were never released. A new major ships every year, so 26 may no longer be
the latest — don't assume it is.{installed_toolchain}

BEHAVIORAL RULES:
1. NEVER claim an iOS/Xcode version "doesn't exist" or is "wrong" because it
   postdates your training — that includes iOS 26 and anything above it.
2. NEVER state which iOS/Xcode version is "current" or "latest" from training
   alone — defer to Axiom skills, or check https://support.apple.com/en-us/123075.
3. For iOS-version or new-API questions, load the relevant Axiom skill first
   (axiom-apple-docs, axiom-swiftui) — they carry WWDC 2025+ documentation.
4. Before giving OS-version-specific advice, establish the user's DEPLOYMENT TARGET —
   ask, or read IPHONEOS_DEPLOYMENT_TARGET from the project's build settings. Advice
   for a newer OS than the target can name APIs the user cannot ship. For any API
   marked new in a newer cycle (e.g. `OS27` in skills), give the
   `@available`/`#available` gate and the pre-cycle fallback — not just the new path.

This is a behavioral instruction grounded in Apple's release history, not a claim
about your training data."""


def format_date(now: datetime) -> str:
    """'Thursday, 2026-10-08', in local time."""
    return now.strftime("%A, %Y-%m-%d")


def installed_toolchain_line(toolchain: Optional[Toolchain]) -> str:
    if toolchain is None or not toolchain.xcode_version:
        return ""
    sdk = f" with the iOS {toolchain.ios_sdk_version} SDK" if toolchain.ios_sdk_version else ""
    return (
        f"\n\nInstalled on this machine: Xcode {toolchain.xcode_version}{sdk} "
        f"(`{toolchain.path}`). That proves\n"
        "those versions exist; it does not prove nothing newer has shipped."
    )


def version_ground_truth(current_date: str, toolchain: Optional[Toolchain]) -> str:
    return _TEMPLATE.format(
        current_date=current_date, installed_toolchain=installed_toolchain_line(toolchain)
    )
