---
name: watchos-a11y
description: watchOS-specific accessibility — VoiceOver, AssistiveTouch, Double Tap, large-accessibility Dynamic Type, custom adjustable controls, and complication labels
---

# Accessibility on watchOS

Support for the three assistive technologies that ship on Apple Watch — VoiceOver, AssistiveTouch (watchOS 8+), and Double Tap (watchOS 11+) — plus Dynamic Type at the large accessibility sizes introduced in watchOS 8. The rest of the `axiom-accessibility` suite covers cross-platform fundamentals; this skill adds what's specific to watchOS.

## When to Use

Use this skill when:
- You're auditing a watchOS app for VoiceOver, AssistiveTouch, or Double Tap support
- You're implementing Dynamic Type on watch faces, watch UI, complications, or notifications
- You're making a custom watch control (counter, scrubber, picker) VoiceOver-adjustable
- AssistiveTouch cursor frames clip icons or miss tappable elements
- You're supporting watchOS 8's large accessibility text sizes
- You need to debug why an element isn't focusable via AssistiveTouch
- Your complications and dynamic notifications need spoken-form accessibility labels

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "How do I make a custom stepper VoiceOver-adjustable on watchOS?"
- "AssistiveTouch isn't focusing the text inside my tappable VStack — why?"
- "How should I bind Double Tap to my workout's Start button?"
- "What needs to change in my watch UI to support accessibility5 text size?"
- "My complication reads 'Wed Mar 9' to VoiceOver — how do I get a spoken form?"
- "Why is the AssistiveTouch cursor clipping my ellipsis icon?"

## What This Skill Provides

- **Three assistive technologies** – How VoiceOver, AssistiveTouch, and Double Tap differ in input model and SwiftUI API, and why your design must work with any combination enabled
- **Three Dynamic Type rules** – Use a text style instead of `Font.system(size:)`; let text wrap rather than capping `lineLimit` at 1; switch to a vertical layout at large sizes by reading `@Environment(\.dynamicTypeSize)`
- **Complication and notification coverage** – Spoken-form labels for abbreviations, labels on complication images, overrides for SF Symbol default labels, and accessibility on dynamic notifications
- **VoiceOver patterns** – Let `NavigationLink` combine row children, put context in the label (not just the value), and add an explicit `accessibilityLabel` to symbol-only buttons
- **Custom adjustable control recipe** – Collapse multi-button steppers into one element with `accessibilityElement()` + `accessibilityLabel` + `accessibilityValue` + `accessibilityAdjustableAction`
- **AssistiveTouch support** – Focusable-element rules (the "tappable `VStack` with non-interactive `Text`" trap), `accessibilityRespondsToUserInteraction(true)`, 44×44pt cursor frames via `contentShape`, and the action menu that `accessibilityAction` populates
- **Double Tap rules** – Bind with `handGestureShortcut(.primaryAction)`, keep exactly one primary action per screen, and treat Double Tap as an accelerator, never the only path
- **Testing checklist** – Eight concrete verification steps covering VoiceOver, Dynamic Type, custom controls, AssistiveTouch cursor, Double Tap, complications, and notifications
- **Common mistakes table** – Eleven mistakes, each with its symptom and fix

## Documentation Scope

This page documents the `watchos-a11y` skill in the `axiom-accessibility` suite. The skill file contains comprehensive guidance your assistant uses when answering your questions, including code for each pattern, the testing checklist, and the common-mistakes table.

## Related

- [accessibility-diag](/diagnostic/accessibility-diag) – Cross-platform VoiceOver, Dynamic Type, contrast, and WCAG fundamentals; this skill adds the watchOS layer
- [ux-flow-audit](/skills/ui-design/ux-flow-audit) – Its Accessibility Dead Ends category finds actions that only gestures or visual cues can reach, invisible to assistive technology
- [design-for-watchos](/skills/watchos/design-for-watchos) – The watchOS 10 navigation model and Always On design
- [smart-stack-and-complications](/skills/watchos/smart-stack-and-complications) – The complication surfaces that need spoken-form accessibility labels
- [controls-and-live-activities](/skills/watchos/controls-and-live-activities) – Control surfaces and the Double Tap primary-action binding

## Resources

**WWDC**: 2021-10223, 2021-10308, 2024-10205

**Docs**: /watchos-apps/create-accessible-experiences-for-watchos, /swiftui/environmentvalues/sizecategory, /swiftui/view/accessibilityadjustableaction(_:), /swiftui/view/accessibilityrespondstouserinteraction(_:), /swiftui/view/handgestureshortcut(_:isenabled:)

**Skills**: axiom-accessibility, axiom-watchos
