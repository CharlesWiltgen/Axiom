"""Offline tests for the stop-validation hook (iOS version sanity check).

Run with:
    python3 -m unittest hooks/stop-validation_test.py

The hook reads `{"transcript_path": ..., "stop_hook_active": ...}` on stdin,
greps the last assistant text message in the JSONL transcript, and emits
`{"decision": "approve"|"block", "reason": ...}`.

Ground truth the hook enforces (must match hooks/session-start.py): Apple went
from iOS 18 straight to iOS 26 at WWDC 2025; iOS 19-25 were never released.

Design intent under test (GH #39 / axiom-uyk): a *bare mention* of iOS 19-25 is
fine (explaining the skip, paraphrasing the SessionStart context). The hook only
blocks (a) sentences that treat one of 19-25 as a real/current version, and
(b) sentences that deny iOS 26's existence/release. It must NOT block legitimate
"as of iOS 26.1, ..." / "iOS 26 has a limitation that's not yet fixed" prose.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "stop-validation.sh")


def decide(assistant_text: str) -> str:
    """Run the hook against a transcript whose last assistant message is `assistant_text`.

    Returns the hook's decision string ("approve" / "block").
    """
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as tx:
        tx.write(json.dumps({
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": assistant_text}]},
        }) + "\n")
        transcript_path = tx.name
    try:
        result = subprocess.run(
            ["bash", HOOK],
            input=json.dumps({
                "transcript_path": transcript_path,
                "stop_hook_active": False,
            }),
            capture_output=True,
            text=True,
            timeout=10,
        )
        self_assert_ok(result)
        return json.loads(result.stdout.strip())["decision"]
    finally:
        os.unlink(transcript_path)


def self_assert_ok(result: subprocess.CompletedProcess) -> None:
    if result.returncode != 0:
        raise AssertionError(
            f"hook exited {result.returncode}: stderr={result.stderr!r}"
        )


# Skip the whole module if jq isn't available — the hook degrades to
# "approve (jq not available)" without it, so the assertions below can't run.
_HAVE_JQ = subprocess.run(["bash", "-c", "command -v jq"],
                          capture_output=True).returncode == 0


@unittest.skipUnless(_HAVE_JQ, "jq not installed — stop-validation degrades to approve-all")
class TestApprovesLegitMentions(unittest.TestCase):
    """A bare mention of iOS 19-25, or any normal iOS 26 prose, must pass."""

    def test_explains_the_skip(self):
        self.assertEqual("approve", decide(
            "Apple went straight from iOS 18 to iOS 26 at WWDC 2025; the "
            "in-between majors (19-25) were never released."))

    def test_paraphrases_sessionstart_context(self):
        # The exact shape session-start.py injects, quoted back to the user.
        self.assertEqual("approve", decide(
            "Per the Axiom hook: iOS 26 is the current major line — Apple went "
            "straight from iOS 18 to iOS 26 at WWDC 2025; the in-between majors "
            "(19-25) were never released. Xcode 26 ships with it."))

    def test_lists_the_numbers_as_nonexistent(self):
        self.assertEqual("approve", decide(
            "The Axiom hook tells me iOS 19, 20, 21, 22, 23, 24, 25 do not exist."))

    def test_range_in_a_skip_phrase(self):
        self.assertEqual("approve", decide(
            "From iOS 18 to iOS 26, Apple skipped iOS 19 to iOS 25."))

    def test_as_of_ios_26_point_release(self):
        # axiom-uyk false-positive case #1.
        self.assertEqual("approve", decide(
            "As documented in iOS 26.1, the toolbar uses Liquid Glass; one "
            "limitation is not yet fixed."))

    def test_ios_26_limitation_not_available(self):
        # axiom-uyk false-positive case #2: "not available" near "iOS 26".
        self.assertEqual("approve", decide(
            "iOS 26 has a known limitation that's not available on older devices."))

    def test_cites_ios_26_as_reality(self):
        self.assertEqual("approve", decide(
            "I cited iOS 26.0 (build 24A343), iOS 26.1 and Xcode 26 throughout — "
            "all consistent with iOS 26 being shipping reality."))

    def test_targets_ios_26(self):
        self.assertEqual("approve", decide("This package targets iOS 26 and later."))


@unittest.skipUnless(_HAVE_JQ, "jq not installed — stop-validation degrades to approve-all")
class TestBlocksWrongClaims(unittest.TestCase):
    """Treating 19-25 as real, or denying iOS 26, must be blocked."""

    def test_latest_is_a_fake_version(self):
        self.assertEqual("block", decide("The latest iOS is iOS 21."))

    def test_in_fake_version_you_can(self):
        self.assertEqual("block", decide("In iOS 23 you can use the new layout API."))

    def test_upgrade_to_fake_version(self):
        self.assertEqual("block", decide("Upgrade to iOS 20 to get this feature."))

    def test_requires_fake_version(self):
        self.assertEqual("block", decide("This API requires iOS 19 or newer."))

    def test_denies_ios_26_exists(self):
        self.assertEqual("block", decide(
            "iOS 26 doesn't exist yet — the current version is iOS 18."))

    def test_there_is_no_ios_26(self):
        self.assertEqual("block", decide(
            "There is no iOS 26; Apple hasn't announced it."))

    def test_ios_26_isnt_real(self):
        self.assertEqual("block", decide("iOS 26 isn't a real version."))

    def test_ios_26_was_never_released(self):
        self.assertEqual("block", decide("iOS 26 was never released."))


@unittest.skipUnless(_HAVE_JQ, "jq not installed")
class TestHookSafetyValves(unittest.TestCase):
    def test_no_transcript_path_approves(self):
        result = subprocess.run(
            ["bash", HOOK],
            input=json.dumps({"transcript_path": "", "stop_hook_active": False}),
            capture_output=True, text=True, timeout=10,
        )
        self_assert_ok(result)
        self.assertEqual("approve", json.loads(result.stdout.strip())["decision"])

    def test_stop_hook_active_short_circuits_to_approve(self):
        # Even with a transcript that would otherwise block, a retry is allowed
        # through (loop guard).
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as tx:
            tx.write(json.dumps({
                "type": "assistant",
                "message": {"content": [{"type": "text", "text": "iOS 26 was never released."}]},
            }) + "\n")
            transcript_path = tx.name
        try:
            result = subprocess.run(
                ["bash", HOOK],
                input=json.dumps({"transcript_path": transcript_path, "stop_hook_active": True}),
                capture_output=True, text=True, timeout=10,
            )
            self_assert_ok(result)
            self.assertEqual("approve", json.loads(result.stdout.strip())["decision"])
        finally:
            os.unlink(transcript_path)


if __name__ == "__main__":
    unittest.main()
