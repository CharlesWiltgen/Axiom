---
name: xcui-ref
description: Complete reference for the `xcui` CLI that ships with Axiom — doctor/wait/assert/a11y/dialog/voiceover subcommands for scriptable iOS-simulator UI and accessibility testing, output envelope, exit codes, the verified accessibility toggles, system-dialog handling, computed VoiceOver, and how it divides labor with AXe
---

# xcui Reference (Scriptable Simulator UI & Accessibility Testing)

Complete reference for `xcui`, the Axiom-bundled CLI that makes iOS-simulator UI and accessibility testing scriptable for coding harnesses. It owns the test-harness semantics AXe and `simctl` lack — waiting on conditions, asserting on the accessibility tree, toggling accessibility settings, handling system permission dialogs, and computing VoiceOver announcements — and delegates input (`tap`/`type`/`swipe`) to AXe, which injects real HID touch. Every subcommand emits a single compact JSON object with a `tool`/`version` envelope (token-lean for LLM consumers); most verbs also accept `--human` for a prose rendering, and exit codes drive pass/fail in scripts.

## When to Use This Reference

Use this reference when:
- Looking up `xcui doctor` / `wait` / `assert` / `a11y set` / `a11y reset` / `dialog` / `voiceover` subcommand flags
- Interpreting an exit code (0 pass / 1 assertion-fail or wait-timeout / 2 environment error / 8 output-write error)
- Checking which accessibility toggles `a11y set` supports and how each is applied (native `simctl ui` vs `defaults write` + relaunch)
- Handling a system permission alert in a test — tapping the right button (`dialog accept`/`dismiss`) or pre-granting so it never appears (`dialog pregrant`)
- Validating VoiceOver announcements and focus order without capturing audio (`voiceover traverse`/`assert`)
- Understanding how `xcui` auto-resolves the booted simulator and when to pass `--udid`
- Deciding what to drive with `xcui` versus what to call on `axe` directly (taps, typing, gestures)
- Switching between JSON (default) and `--human` output
- Diagnosing why a `doctor` run reports exit 2 (AXe missing or no booted sim)

## Example Prompts

- "How do I wait for an element to appear on the simulator before asserting?"
- "How do I assert a VoiceOver label and trait on an element?"
- "How do I turn on Dynamic Type or Increase Contrast on the simulator?"
- "How do I dismiss the camera permission dialog in my test — or skip it entirely?"
- "How do I check the VoiceOver announcement order without listening to audio?"
- "What does `xcui doctor` check, and how do I install AXe?"
- "Why did `xcui assert` exit 1?"
- "Why isn't my accessibility toggle taking effect until I relaunch the app?"

## What's Covered

- **Invocation** — `xcui` is on PATH as a bare command (plugin `bin/` is auto-resolved); run `xcui <subcommand>`
- **`doctor` subcommand** — verifies AXe, Homebrew, Xcode, and a booted simulator; `--install` runs `brew install cameroncooke/axe/axe` (explicit/consented, never silent); `--human` for prose. Always auto-resolves the booted sim
- **`wait` subcommand** — `--for-element <id>`, `--gone <id>`, or `--idle`, with `--timeout` and `--poll`; polls the accessibility tree until the condition holds or the deadline passes (the headless equivalent of `waitForExistence`)
- **`assert` subcommand** — `--id <id>` plus optional `--label`, `--value`, `--trait`, and `--single`; `--single` asserts the id resolves to exactly one element; `--trait` matches a bare word (`button`, `image`) against the AX role or type
- **`a11y set` / `a11y reset`** — the four verified toggles and how each is applied (see table below); `--app <bundle-id>` triggers an app relaunch for the toggles that need it
- **`dialog` subcommand** — `accept` / `dismiss` find the frontmost system alert and tap the correct standard button (permission grants, `OK`, `Cancel`); a one-button alert is tapped for either intent; matching is case- and apostrophe-insensitive. `pregrant <bundle-id> <service>…` grants permissions via `simctl privacy` so the dialog never appears. Exit `0` handled, `1` no actionable alert
- **`voiceover` subcommand** — `traverse` walks the tree in focus order and emits the **computed** announcement sequence (`label, value, trait`, plus `dimmed` when disabled); `assert --sequence <file>` compares the live sequence to an expected one and reports every differing index (plus a length-mismatch note when counts differ). This is computed from the accessibility tree, **not** captured TTS audio (which the simulator does not expose) — use it to catch missing labels, wrong traits, and bad focus order
- **Input via AXe** — `xcui` does not re-wrap `tap`/`type`/`swipe`/`touch`; call `axe` directly for real HID input, and `axe describe-ui` for the raw tree `xcui` parses
- **Output envelope & exit codes** — single compact JSON object with `tool`/`version` first; most verbs accept `--human` for prose (`a11y` and `voiceover` are JSON-only for now); exit `0` pass · `1` assertion-fail/wait-timeout · `2` environment error · `8` output-write error
- **CLI grammar gotcha** — Go's flag parser stops at the first positional, so always use the all-flag forms (`assert --id …`, not `assert <id> …`)

## Accessibility Toggles

`a11y set --toggle <name> --value <…>` supports the following, all verified against the booted simulator. `a11y reset` clears them (deletes the `defaults` keys, sets `content_size large`, sets `increase_contrast disabled`).

| Toggle | Mechanism | `--value` | Relaunch |
|--------|-----------|-----------|----------|
| `dynamic-type` | native `simctl ui content_size` | a size (`large` … `accessibility-extra-extra-extra-large`) | no |
| `increase-contrast` | native `simctl ui increase_contrast` | `on` / `off` | no |
| `reduce-motion` | `defaults write com.apple.Accessibility ReduceMotionEnabled` | `on` / `off` | yes (pass `--app`) |
| `reduce-transparency` | `defaults write com.apple.Accessibility ReduceTransparencyEnabled` | `on` / `off` | yes (pass `--app`) |

`voiceover`, `differentiate-without-color`, and `bold-text` are **not supported in v1** — they had no confirmable simulator mechanism (no native `simctl ui` setter, and their candidate `defaults` keys are not honored on the sim), so they were omitted rather than shipped unverified.

## Documentation Scope

This page documents the `xcui-ref` reference skill — the bundled Axiom CLI for scriptable simulator UI and accessibility testing.

- For the agent that drives `xcui` live (set toggles, wait, assert on the tree), see the [simulator-tester agent](/agents/simulator-tester)
- For static accessibility *source* scanning (the read-only counterpart that pairs with live validation), see the [accessibility-auditor agent](/agents/accessibility-auditor)
- For the input primitives `xcui` delegates to, see [AXe (Simulator Automation)](/reference/axe-ref)
- For the `/axiom:ui` command wrapper, see [/axiom:ui](/commands/testing/ui)
- For the sibling bundled tools, see [Console Capture (xclog)](/reference/xclog-ref) and [Crash Symbolication (xcsym)](/reference/xcsym-ref)
