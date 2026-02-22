# UIKit-SwiftUI Bridging

Systematic guidance for bridging UIKit and SwiftUI — wrapping UIKit views in SwiftUI, embedding SwiftUI in UIKit, and avoiding the lifecycle and memory pitfalls that cost developers hours.

## When to Use

Use this skill when:

- Wrapping a UIView subclass (MKMapView, WKWebView, custom views) for use in SwiftUI
- Wrapping a UIViewController (pickers, mail compose, Safari) for use in SwiftUI
- Wrapping a UIGestureRecognizer subclass for use in SwiftUI (iOS 18+)
- Embedding SwiftUI views in an existing UIKit navigation hierarchy
- Sharing state between UIKit and SwiftUI with @Observable
- Using SwiftUI for UICollectionView/UITableView cell content (iOS 16+)
- Debugging UIViewRepresentable lifecycle issues (flickering, stale state, memory leaks)
- Deciding which bridging pattern to use

## Example Prompts

- "How do I wrap a UIKit view in SwiftUI?"
- "How do I embed SwiftUI in my UIKit app?"
- "How do I use a UIKit gesture recognizer in SwiftUI?"
- "How do I share state between UIKit and SwiftUI with @Observable?"
- "My UIViewRepresentable isn't updating correctly"
- "How do I use UIHostingConfiguration for collection view cells?"
- "Navigation bar large title won't collapse with my wrapped scroll view"
- "My coordinator has a memory leak"
- "Should I use UIViewRepresentable or UIViewControllerRepresentable?"
- "SwiftUI environment values aren't working in UIHostingController"

## What This Skill Provides

- **Decision framework** for choosing the right bridging pattern (5 branches)
- **UIViewRepresentable** lifecycle, state synchronization, coordinator pattern, sizing, layout property rules
- **UIViewControllerRepresentable** for wrapping full view controllers with delegation
- **UIGestureRecognizerRepresentable** (iOS 18+) for wrapping UIKit gesture recognizers with coordinate space conversion
- **UIHostingController** embedding patterns including child VC sizing, `sizeThatFits(in:)`, and environment bridging via `UITraitBridgedEnvironmentKey`
- **UIHostingConfiguration** for SwiftUI-powered collection/table view cells with margins, min size, and background customization (iOS 16+)
- **@Observable shared state** patterns for UIKit and SwiftUI coexistence, including UIKit automatic observation tracking (iOS 26+)
- **Keyboard handling** in hybrid layouts with `UIKeyboardLayoutGuide`
- **Common gotchas table** with symptoms and fixes for the most frequent issues
- **Anti-patterns** that prevent hours of debugging

## Related

- [App Composition](/skills/ui-design/app-composition) — App-level integration strategy and migration priority for UIKit → SwiftUI adoption
- [SwiftUI Animation](/reference/swiftui-animation-ref) — Advanced animation bridging patterns; this skill covers basic `context.transaction.animation` usage
- [Camera Capture](/skills/integration/camera-capture) — Domain-specific UIViewRepresentable example for camera preview
