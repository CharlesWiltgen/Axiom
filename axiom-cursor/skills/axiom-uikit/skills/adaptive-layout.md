# UIKit Adaptive Layout — Building

Constructing UIKit layouts that adapt to any window size. `skills/auto-layout-debugging.md` is for when constraints break; this skill is for building them so they don't. The geometry ground rules (never `UIScreen.main`, size from bounds/scene, resizability at 27) live in `skills/uikit-modernization.md`.

## Anchor to guides, not edges

Every guide is a `UILayoutGuide` (iOS 9) — constrain to the one that expresses your intent:

| Guide | Expresses |
|---|---|
| `view.safeAreaLayoutGuide` (iOS 11) | keep content out of bars, notches, window controls |
| `view.layoutMarginsGuide` (iOS 9) | the view's standard content inset |
| `view.readableContentGuide` (iOS 9) | comfortable reading width — **caps line length automatically in wide windows**, the UIKit answer to "max readable content width" |
| `view.keyboardLayoutGuide` (iOS 15) | tracks the docked keyboard; set `followsUndockedKeyboard = true` to also track undocked/floating iPad keyboards |
| custom `UILayoutGuide` | invisible spacing/alignment regions — no dummy views |

```swift
textView.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    textView.leadingAnchor.constraint(equalTo: view.readableContentGuide.leadingAnchor),
    textView.trailingAnchor.constraint(equalTo: view.readableContentGuide.trailingAnchor),
    textView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
    textView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
])
```

A text column constrained to `readableContentGuide` handles the wide-window case for free; one constrained to the view's edges becomes an unreadable 1,200-point line.

## Width-conditional constraint sets

The UIKit equivalent of SwiftUI's `AnyLayout` switch: build both sets once, activate the right one on trait change. Never rebuild constraints per layout pass.

```swift
final class ProfileView: UIView {
    private var compactConstraints: [NSLayoutConstraint] = []
    private var regularConstraints: [NSLayoutConstraint] = []

    private func applyLayout(for traits: UITraitCollection) {
        let isCompact = traits.horizontalSizeClass == .compact
        NSLayoutConstraint.deactivate(isCompact ? regularConstraints : compactConstraints)
        NSLayoutConstraint.activate(isCompact ? compactConstraints : regularConstraints)
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        registerForTraitChanges([UITraitHorizontalSizeClass.self]) {
            (self: Self, _: UITraitCollection) in
            self.applyLayout(for: self.traitCollection)
        }
    }

    required init?(coder: NSCoder) { fatalError() }
}
```

- **Deactivate before activate** — the overlap instant otherwise produces unsatisfiable-constraint spew (and a trip to `skills/auto-layout-debugging.md`).
- `registerForTraitChanges` (iOS 17) replaces `traitCollectionDidChange`; register only for the traits you use.
- Size class answers "roomy or constrained"; for a numeric breakpoint, condition on `bounds.width` in `layoutSubviews` — but prefer the trait when it expresses the real question (see `skills/uikit-modernization.md` on which input to use).

## Self-sizing cells

- `UITableView`: `rowHeight` defaults to `UITableView.automaticDimension` — self-sizing is on when cell content has a complete top-to-bottom constraint chain. Set `estimatedRowHeight` near typical height so scroll metrics stay sane.
- `UICollectionView` compositional layout: use `.estimated(_:)` dimensions and the cell sizes itself.
- A cell that doesn't self-size almost always has a broken vertical constraint chain or a missing hugging/compression priority — `skills/auto-layout-debugging.md` covers priority levels and hugging/compression fixes.

## Compositional layout that responds to its environment

The section provider runs again when the container changes, receiving the **actual container size** — column math belongs there, not in device checks:

```swift
let layout = UICollectionViewCompositionalLayout { sectionIndex, environment in
    let width = environment.container.effectiveContentSize.width
    let columns = max(1, Int(width / 250))
    let item = NSCollectionLayoutItem(
        layoutSize: .init(widthDimension: .fractionalWidth(1.0 / CGFloat(columns)),
                          heightDimension: .estimated(120)))
    let group = NSCollectionLayoutGroup.horizontal(
        layoutSize: .init(widthDimension: .fractionalWidth(1.0),
                          heightDimension: .estimated(120)),
        subitems: [item])
    return NSCollectionLayoutSection(group: group)
}
```

`environment` also carries `traitCollection` for size-class-keyed decisions. This is the UIKit peer of SwiftUI's adaptive `LazyVGrid` — the environment closure replaces every `UIScreen.main.bounds`-derived column count.

## Measuring: systemLayoutSizeFitting

To measure a constraint-built view outside a layout pass (sizing a popover, a scroll content height):

```swift
let size = header.systemLayoutSizeFitting(
    CGSize(width: targetWidth, height: UIView.layoutFittingCompressedSize.height),
    withHorizontalFittingPriority: .required,
    verticalFittingPriority: .fittingSizeLevel)
```

Fix the axis you know, let the other compress — the same proposal-and-response idea SwiftUI formalizes.

## Resources

**Docs**: /uikit/uilayoutguide, /uikit/uiview/readablecontentguide, /uikit/uikeyboardlayoutguide, /uikit/uicollectionviewcompositionallayout, /uikit/nscollectionlayoutenvironment, /uikit/uiview/systemlayoutsizefitting(_:withhorizontalfittingpriority:verticalfittingpriority:)

**Skills**: skills/auto-layout-debugging.md, skills/uikit-modernization.md, skills/uikit-bridging.md, axiom-swiftui (skills/layout.md)
