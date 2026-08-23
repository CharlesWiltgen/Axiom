# Presentations — Sheets, Detents, Popovers, Adaptation

Every presentation is now shown across a range of window shapes — at 27 even iPhone apps resize (iPhone Mirroring, iPhone-on-iPad), so presentation adaptation is no longer an iPad-only concern. Pick the surface by role, then control how it adapts when the size class changes.

## Choosing the presentation

| Need | Use |
|------|-----|
| Self-contained task or flow | `.sheet` |
| Transient anchored content in regular width | `.popover` (adapts to sheet on iPhone automatically) |
| Immersive takeover (onboarding, media, camera) | `.fullScreenCover` |
| Confirm a just-tapped action | `.confirmationDialog` (anchored to the source in regular width) |
| Interrupt with a decision | `.alert` |
| Persistent detail/utility panel in regular width | `.inspector` — a trailing column in horizontally regular width, adapting to a sheet in compact; see axiom-macos (skills/swiftui-differences.md) |
| Secondary workspace on iPad/Mac | a second window via `openWindow` — see axiom-design (skills/app-composition.md) |

In regular width, prefer an inspector, split column, or second window over full-screen modality — a full-screen takeover of a large window hides everything for one task.

## Resizable sheets — detents

```swift
.sheet(isPresented: $showingDetail) {
    DetailView()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
}
```

- `PresentationDetent` (iOS 16): `.medium`, `.large`, `.fraction(0.3)`, `.height(280)`, `.custom(MyDetent.self)` (`CustomPresentationDetent`).
- Track or drive the active detent with `presentationDetents(_:selection:)`.
- `presentationBackgroundInteraction(.enabled(upThrough: .height(280)))` keeps the content behind a low sheet interactive — the maps-style non-modal pattern. `.disabled` restores modality.
- `presentationContentInteraction(.scrolls)` makes swipes scroll the content instead of resizing the sheet first (`.resizes` is the opposite priority, `.automatic` the default).
- `interactiveDismissDisabled()` blocks swipe-to-dismiss — pair it with an explicit Cancel button or it becomes a dismiss trap (skills/toolbars.md Pattern 2; the `ux-flow-auditor` agent flags these).

**Vertically compact trap** A sheet over a vertically compact view (iPhone landscape) shows as a full-screen cover by default — your medium detent silently disappears. Override per axis with `presentationCompactAdaptation(horizontal:vertical:)`.

## Sheet sizing in large windows — presentationSizing (iOS 18)

On iPad and Mac a plain sheet gets a system default size. Size it by content role instead:

```swift
.sheet(item: $selection) { item in
    EditorView(item)
        .presentationSizing(.form)        // .form, .page, .fitted
}
```

`.fitted(horizontal:vertical:)` sizes to the content's ideal size per axis.

## Popovers and compact adaptation

```swift
Button("Filters") { showingFilters = true }
    .popover(isPresented: $showingFilters,
             attachmentAnchor: .rect(.bounds),   // default
             arrowEdge: nil) {                   // nil = system picks the edge
        FilterView()
            .presentationCompactAdaptation(.none)   // stay a popover on iPhone
    }
```

- **Attach the modifier to the anchor control**, not an ancestor — `attachmentAnchor` defaults to the modified view's bounds (`.rect(.bounds)`; `.point(...)` for a unit-point anchor). For toolbar buttons, attach `.popover` to the view inside the `ToolbarItem`.
- `arrowEdge` was not reliably respected on iOS before 18.1 (always was on macOS).
- **Default adaptation**: on iPhone a popover becomes a sheet; in vertically compact contexts it becomes a full-screen cover. `PresentationAdaptation` values: `.automatic`, `.none`, `.popover`, `.sheet`, `.fullScreenCover`.
- **The 27 twist**: a resized iPhone window stays horizontally `.compact` at any width (see skills/layout-ref.md), so "wide window" does NOT mean "popover-capable" — an iPhone app's popovers adapt to sheets even in a Mac-sized Mirroring window unless you opt out with `.presentationCompactAdaptation(.none)`. Decide by testing both, not by assuming iPad behavior.

## Adaptation discipline

- One presentation state model; let the system adapt the container. Don't branch `if hSize == .regular { .popover } else { .sheet }` — that is what `presentationCompactAdaptation` is for.
- Presentation modifiers (`presentationDetents`, `presentationCompactAdaptation`, ...) go on the presented **content**, not on the presenting view.
- System presentation containers ship with system-maintained dismissal affordances, and standard controls receive translated indirect input (trackpad, scroll devices, iPhone Mirroring) correctly. A custom ZStack overlay posing as a presentation only gets whatever gestures you wire, and custom pan/drag handling needs explicit indirect-input support — one more reason to use the system containers (see axiom-uikit (skills/uikit-modernization.md)).
- Keyboard inside a sheet: `scrollDismissesKeyboard(.interactively)` on the sheet's scroll view controls how scrolling dismisses it.

## Resources

**Docs**: /swiftui/view/presentationdetents(_:), /swiftui/presentationdetent, /swiftui/view/presentationcompactadaptation(_:), /swiftui/view/popover(ispresented:attachmentanchor:arrowedge:content:), /swiftui/view/presentationsizing(_:), /swiftui/view/presentationbackgroundinteraction(_:), /swiftui/view/interactivedismissdisabled(_:)

**Skills**: skills/toolbars.md, skills/layout-ref.md, skills/nav.md, axiom-macos (skills/swiftui-differences.md), axiom-design (skills/app-composition.md), axiom-uikit (skills/uikit-modernization.md)
