---
name: auto-layout-debugging
description: Systematic debugging workflow for Auto Layout constraint conflicts and ambiguous layouts
skill_type: discipline
version: 1.0.0
---

# Auto Layout Debugging

Systematic debugging for Auto Layout constraint errors. Covers constraint conflicts, ambiguous layouts, and views positioned incorrectly.

## When to Use This Skill

Use this skill when you're:
- Seeing "Unable to simultaneously satisfy constraints" errors
- Views positioned incorrectly or not appearing
- Constraint warnings during app launch or navigation
- Ambiguous layout errors
- Views appearing at unexpected sizes
- Debug View Hierarchy shows misaligned views
- Storyboard/XIB constraints behaving differently at runtime

**Time savings:** Typical debugging without workflow: 30-60 minutes. With systematic approach: 5-10 minutes.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I'm getting 'Unable to simultaneously satisfy constraints' but I can't figure out which view."
- "How do I set up a breakpoint to catch constraint conflicts?"
- "My view appears at the wrong size even though I set width/height constraints."
- "What does 'UIView-Encapsulated-Layout-Height' mean in the error?"
- "How do I use lldb to debug Auto Layout issues?"
- "My cell is showing constraint errors but I can't identify which constraints conflict."

## What's Covered

### Understanding Error Messages
- Anatomy of constraint conflict messages
- Memory addresses for view/constraint identification
- System-generated constraints (UIView-Encapsulated-Layout)
- Autoresizing mask translation (h=--&, v=&--)

### Debugging Workflow
- Symbolic breakpoint setup (UIViewAlertForUnsatisfiableConstraints)
- Memory address identification with po (lldb)
- _autolayoutTrace for ambiguous layouts
- Debug View Hierarchy with constraint inspection

### Common Patterns
- Cell content with intrinsic size conflicts
- Compression resistance vs hugging priority
- System constraint conflicts (encapsulated layout)
- Safe area and layout margins issues

### Resolution Strategies
- Priority adjustment (999 vs 1000)
- Removing redundant constraints
- Content hugging and compression resistance
- Fixing ambiguous layouts

## Key Pattern

### Decision Tree

```
Constraint error in console?
├─ Can't identify which views?
│  └─ Use Symbolic Breakpoint + Memory Address Identification
├─ Constraint conflicts shown?
│  └─ Use Constraint Priority Resolution
├─ Ambiguous layout (multiple solutions)?
│  └─ Use _autolayoutTrace to find missing constraints
└─ Views positioned incorrectly but no errors?
   └─ Use Debug View Hierarchy + Show Constraints
```

### Symbolic Breakpoint Setup (One-Time)

1. Open Breakpoint Navigator (⌘+8)
2. Click `+` → "Symbolic Breakpoint"
3. **Symbol**: `UIViewAlertForUnsatisfiableConstraints`
4. (Optional) Add Action → "Sound"
5. Run app — breakpoint fires at exact moment of conflict

### Identifying Views from Memory Address

```lldb
(lldb) po 0x7f8b9c4...
<UILabel: 0x7f8b9c4; frame = ...; text = 'Hello'>
```

The memory address in the error message (0x7f8b9c4...) can be printed in the debugger to identify which view is involved.

### Priority Resolution

```swift
// ❌ Conflict: Both have priority 1000 (Required)
label.widthAnchor.constraint(equalToConstant: 300).isActive = true
superview.widthAnchor.constraint(equalToConstant: 200).isActive = true

// ✅ Resolved: Lower priority allows system to break one
let widthConstraint = label.widthAnchor.constraint(equalToConstant: 300)
widthConstraint.priority = .defaultHigh  // 750
widthConstraint.isActive = true
```

## Documentation Scope

This page documents the `axiom-auto-layout-debugging` skill—systematic debugging workflows Claude uses when you encounter Auto Layout constraint conflicts in UIKit apps.

**For SwiftUI layout issues:** See [swiftui-debugging](/skills/ui-design/swiftui-debugging) for SwiftUI-specific layout debugging.

## Related

- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — SwiftUI view update and layout issues
- [xcode-debugging](/skills/debugging/xcode-debugging) — Environment diagnostics for general Xcode issues

## Resources

**WWDC**: 2015-219 (Mysteries of Auto Layout), 2018-220 (High Performance Auto Layout)

**Docs**: /uikit/nslayoutconstraint, /uikit/uiview/debugging_auto_layout
