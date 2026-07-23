# SwiftUI Presentations

Guidance for sheets, detents, popovers, full-screen covers, and how each presentation adapts across size classes and window shapes — including the iOS 27 reality that iPhone apps resize, so adaptation applies everywhere.

## When to Use

Use this skill when:

- Choosing between a sheet, popover, full-screen cover, inspector, or second window
- Building resizable sheets with detents (`.medium`, `.fraction`, `.height`, custom)
- A popover shows as a sheet on iPhone and you need to control that adaptation
- A medium-detent sheet unexpectedly goes full screen in landscape
- Sizing sheets on iPad and Mac (`presentationSizing`, iOS 18)
- Building maps-style non-modal sheets where the background stays interactive
- Anchoring a popover to a button or toolbar item correctly

## Example Prompts

- "How do I make a half-height sheet with presentationDetents?"
- "Why does my popover show as a sheet on iPhone?"
- "My sheet with a medium detent goes full screen in landscape"
- "How do I keep the map interactive behind a low sheet?"
- "How do I size a sheet on iPad like a form?"
- "How do I stop swipe-to-dismiss on my editing sheet without trapping users?"

## What This Skill Provides

- **Presentation-choice table** – by role: sheet vs popover vs cover vs dialog vs inspector vs second window
- **Detent patterns** – `presentationDetents` with selection tracking, drag indicator, background interaction, content-interaction priority, and the landscape full-screen-cover trap
- **iOS 18 sheet sizing** – `.form`, `.page`, `.fitted` for large windows
- **Popover anchoring and adaptation** – `attachmentAnchor`/`arrowEdge` mechanics, default iPhone sheet adaptation, `presentationCompactAdaptation`, and why a wide iPhone window at iOS 27 still adapts like an iPhone
- **Adaptation discipline** – one state model with system adaptation, modifiers on the presented content, and why system containers beat custom overlay presentations for indirect input

## Related

- [Toolbars](/skills/ui-design/toolbars) – Cancel/Done placement rules for sheet toolbars
- [SwiftUI Layout](/skills/ui-design/swiftui-layout) – the size-class model that drives presentation adaptation
- [SwiftUI Navigation](/skills/ui-design/swiftui-nav) – navigation containers that presentations layer on top of
- [UIKit Modernization](/skills/ui-design/uikit-modernization) – iPhone Mirroring's indirect-input model, which standard presentation containers handle correctly and custom overlays must wire up themselves
