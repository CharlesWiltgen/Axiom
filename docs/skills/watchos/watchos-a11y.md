---
name: watchos-a11y
description: watchOS-specific accessibility — VoiceOver, AssistiveTouch, Double Tap, large-accessibility Dynamic Type, custom adjustable controls, and complication labels
---

# Accessibility on watchOS

A discipline skill for the three assistive technologies that ship on Apple Watch — VoiceOver, AssistiveTouch (watchOS 8+), and Double Tap (watchOS 11+) — plus Dynamic Type at the large accessibility sizes introduced in watchOS 8. Use the broader `axiom-accessibility` skills for cross-platform fundamentals; this skill covers the watchOS-specific additions.

## When to Use

Use this skill when:
- You're auditing a watchOS app for VoiceOver, AssistiveTouch, or Double Tap support
- You're implementing Dynamic Type on watch faces, watch UI, complications, or notifications
- You're making a custom watch control (counter, scrubber, picker) VoiceOver-adjustable
- AssistiveTouch cursor frames are clipping icons or missing tappable elements
- You're supporting watchOS 8's large accessibility text sizes
- You need to debug why an element isn't focusable via AssistiveTouch
- Your complications and dynamic notifications need spoken-form accessibility labels

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I make a custom stepper VoiceOver-adjustable on watchOS?"
- "AssistiveTouch isn't focusing the text inside my tappable VStack — why?"
- "How should I bind Double Tap to my workout's Start button?"
- "What needs to change in my watch UI to support accessibility5 text size?"
- "My complication reads 'Wed Mar 9' to VoiceOver — how do I get a spoken form?"
- "Why is the AssistiveTouch cursor clipping my ellipsis icon?"

## What This Skill Provides

- **Three assistive technologies overview** – Distinct input models and SwiftUI surface for VoiceOver, AssistiveTouch, and Double Tap; design assumes any combination may be enabled
- **Three Dynamic Type rules** – Use a text style instead of `Font.system(size:)`; allow text to wrap (don't cap `lineLimit(1)`); switch to a vertical layout when `@Environment(\.sizeCategory) >= .extraExtraLarge`
- **Complication and notification coverage** – Spoken-form labels for abbreviations, labels on complication images, override SF Symbol default labels, accessibility on dynamic notifications
- **VoiceOver patterns** – Let `NavigationLink` combine row children, put context in the label (not just the value), add explicit `accessibilityLabel` to symbol-only buttons
- **Custom adjustable control recipe** – Collapse multi-button steppers into one element with `accessibilityElement()` + `accessibilityLabel` + `accessibilityValue` + `accessibilityAdjustableAction`
- **AssistiveTouch support** – Focusable-element rules (the "tappable VStack with non-interactive Text" trap), `accessibilityRespondsToUserInteraction(true)`, 44×44pt cursor frames via `contentShape`, action menu population from `accessibilityAction`
- **Double Tap discipline** – Bind with `handGestureShortcut(.primaryAction)`, exactly one primary action per screen, Double Tap is an accelerator (never the only path)
- **Testing checklist** – Eight concrete verification steps covering VoiceOver, Dynamic Type, custom controls, AssistiveTouch cursor, Double Tap, complications, and notifications
- **Common mistakes table** – Eleven specific mistake-symptom-fix triples drawn from real watchOS audits

## Related

- [axiom-accessibility](/diagnostic/accessibility-diag) – Cross-platform VoiceOver, Dynamic Type, contrast, and WCAG fundamentals; this skill adds the watchOS layer
- [UX Flow Audit](/skills/ui-design/ux-flow-audit) – Accessibility Dead Ends category complements this skill from the flow-reachability angle
- [Design for watchOS](./design-for-watchos) – watchOS 10 navigation model and Always-On design considerations
- [Smart Stack and Complications](./smart-stack-and-complications) – Complication surfaces that need spoken-form accessibility labels
- [Controls and Live Activities](./controls-and-live-activities) – Control surfaces and the Double Tap primary action binding
