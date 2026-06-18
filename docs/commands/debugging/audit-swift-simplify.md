---
name: audit-swift-simplify
description: Report behavior-preserving Swift simplifications — guard/optional cleanups, if/switch expressions, collection idioms, redundant boilerplate
---

# audit-swift-simplify

Report behavior-preserving ways to make Swift clearer and more idiomatic — without changing what the code does. Point it at a file, a subsystem, or the whole project.

## What This Command Does

Launches the **swift-simplifier** agent to surface local Swift-language simplification opportunities, each tagged by how safe it is to apply.

## What It Checks

1. **Control flow & optionals** – nested `if let` → `guard`/comma-form, shorthand `if let x`, redundant `else` after `return`/`throw`, `x != nil ? x! : y` → `??`
2. **`if`/`switch` expressions** – temp-var-then-assign ladders and nested ternaries → expressions (Swift 5.9)
3. **Collection idioms** – `.count == 0` → `.isEmpty`, `.filter{}.first` → `.first(where:)`, `.filter{}.count` → `count(where:)` (with purity preconditions)
4. **Boilerplate** – redundant `self.`, redundant inferred type annotations, redundant `return`, verbose closures → trailing/`$0`
5. **Dead availability guards** – always-true `if #available` against your deployment floor

Each finding is tagged SAFE / PRECONDITION / ADVISORY. The agent reports; it does not edit.

## Related Agent

- [swift-simplifier](/agents/swift-simplifier) – The agent that powers this command
