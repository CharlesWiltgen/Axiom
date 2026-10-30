---
name: touch
description: Making Mac apps work with touch on a touch-display Mac or a Sidecar iPad — design rules, gesture recognizers instead of tracking loops, hit targets, hover, exclusive views, system gestures, and non-Apple UI frameworks
---

# Touch on Mac

Getting a Mac app ready for touch on the touch-display MacBook Pro, or on an iPad running iPadOS 27 connected over Sidecar. Touch is a secondary input on macOS, so the work is polish rather than a redesign. Standard AppKit, SwiftUI, and Mac Catalyst controls already work with touch, and custom mouse handling is where apps break.

## When to Use

Use this skill when you're:
- Checking how your Mac app behaves when someone touches the screen
- Migrating `mouseDown` overrides, control subclasses, or `nextEvent(matching:)` tracking loops to gesture recognizers
- Making small targets, like resize grips and canvas handles, easy to hit with a finger
- Keeping hover-revealed actions reachable without a pointer
- Letting several controls move at once, or keeping a three-finger system gesture from interrupting a critical interaction
- Adding touch to an app built on a non-Apple UI framework or game engine
- Tracking down an app that goes unresponsive after a touch gesture

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "Is my AppKit app ready for the touchscreen MacBook Pro?"
- "My `NSButton` subclass overrides `mouseDown` — what happens with touch?"
- "How do I add touch to a view that uses a tracking loop, without rewriting it?"
- "How do I let people move two sliders at once with multitouch?"
- "My app freezes after a gesture over Sidecar. How do I find the stuck recognizer?"
- "What does `NSIsTouchNative` do?"

## What This Skill Provides

- Apple's touch design rules for the Mac: the invisible 36-point touch target, the trackpad-to-touch gesture map, which hover actions to keep, expanding controls, display regions, and the reserved system gestures
- How touch reaches your code, and what each kind of input handling does with it
- The macOS 27 behavior changes: exclusive views, stuck-recognizer diagnostics, `currentEvent` in action methods, and the control-subclass fallback to tracking loops
- Recipes: control events, replacing a tracking loop, adding a touch-only recognizer beside one, enlarging hit targets, filtering recognizers, writing a custom recognizer that always finishes, simultaneous controls, scroll-view interplay, and context menus and drag
- Mouse emulation for non-Apple UI frameworks and the `NSIsTouchNative` opt-out
- Testing with Sidecar, a checklist, and the macOS 27 touch SDK surface
- APIs from Apple's tech talks that aren't in the macOS 27.2 SDK yet, such as the system-gesture opt-outs, marked as such

## Documentation Scope

This page documents the `touch` skill (in the `axiom-macos` suite), which your assistant uses when you prepare a Mac app for touch input.

- To scan a project for touch-readiness problems, use [touch-auditor](/agents/touch-auditor)

## Related

- [appkit-modernization](/skills/macos/appkit-modernization) – The `mouseDown` replacement map and control events this skill builds on
- [swiftui-gestures](/skills/ui-design/swiftui-gestures) – SwiftUI gestures, including filtering by input kind
- [game-input](/skills/games/game-input) – Touch for Mac games: mouse emulation, `GCMouse`, and routing gestures to the engine
- [live-activities](/skills/integration/live-activities) – Live Activities in the Mac's Dynamic Island

## Resources

**Tech Talks**: 111456, 111468

**Docs**: /appkit/handling-appkit-gestures, /appkit/adopting-gesture-recognizers-in-your-app, /technotes/tn3212-adopting-gesture-recognizers-for-sidecar-touch-support, /technotes/tn3216-supporting-touch-input-for-games-on-macos
