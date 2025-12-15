# /axiom:audit-swiftui-nav

Scan SwiftUI navigation for architecture and correctness issues (launches `swiftui-nav-auditor` agent).

## Command

```bash
/axiom:audit-swiftui-nav
```

## What It Checks

### Critical Issues
- **Deep link gaps**: Missing `.onOpenURL` or URL scheme registration
- **State corruption**: Mixing `NavigationLink` types incorrectly

### High Priority
- **Missing NavigationPath**: Prevents programmatic navigation
- **State restoration**: Missing `.navigationDestination` modifiers
- **Type safety**: Multiple destinations for the same data type
- **Data persistence**: Missing `@SceneStorage` for state preservation

### Medium/Low Priority
- **Container usage**: Incorrect `NavigationStack` vs `NavigationSplitView` choice
- **Tab integration**: Issues with iOS 18+ sidebar/tab unification
- **Coordinator patterns**: Logic scattered across views instead of centralized

## When to Use
- Deep links are opening the wrong view or failing
- App loses state when backgrounded or during tab switching
- Navigation push/pop behavior feels erratic
- Implementing a new feature with complex flow

## Related
- [/axiom:audit-swiftui-performance](./audit-swiftui-performance.md) - Check navigation performance
- [swiftui-nav](../../skills/ui-design/swiftui-nav.md) - Comprehensive navigation guide
