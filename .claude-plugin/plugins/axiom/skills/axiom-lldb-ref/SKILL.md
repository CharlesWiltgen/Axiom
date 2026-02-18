---
name: axiom-lldb-ref
description: Complete LLDB command reference — variable inspection, breakpoints, threads, expression evaluation, process control, memory commands, and .lldbinit customization
license: MIT
---

# LLDB Command Reference

Complete command reference for LLDB in Xcode. Organized by task so you can find the exact command you need.

For debugging workflows and decision trees, see `/skill axiom-lldb`.

---

## Part 1: Variable Inspection

### `v` / `frame variable`

Reads memory directly. No compilation. Most reliable for Swift values.

```
(lldb) v                              # All variables in current frame
(lldb) v self                         # Self in current context
(lldb) v self.propertyName            # Specific property
(lldb) v localVariable                # Local variable
(lldb) v self.array[0]               # Collection element
(lldb) v self._showDetails            # SwiftUI @State backing store (underscore prefix)
```

**Flags:**

| Flag | Effect |
|------|--------|
| `-d run` | Run dynamic type resolution (slower but more accurate) |
| `-T` | Show types |
| `-R` | Show raw (unformatted) output |
| `-D N` | Limit depth of nested types to N levels |
| `-P N` | Limit pointer depth to N levels |
| `-F` | Flat output (no hierarchy) |

**Limitations:** Cannot evaluate expressions, computed properties, or function calls. Use `p` for those.

### `p` / `expression` (with format)

Compiles and executes an expression. Shows formatted result.

```
(lldb) p self.computedProperty
(lldb) p items.count
(lldb) p someFunction()
(lldb) p String(describing: someValue)
(lldb) p (1...10).map { $0 * 2 }
```

Result stored in numbered variables:

```
(lldb) p someValue
$R0 = 42
(lldb) p $R0 + 10
$R1 = 52
```

### `po` / `expression --object-description`

Calls `debugDescription` (or `description`) on the result.

```
(lldb) po myObject
(lldb) po error
(lldb) po notification.userInfo
(lldb) po NSHomeDirectory()
```

**When `po` adds value:** Classes with `CustomDebugStringConvertible`, `NSError`, `NSNotification`, collections of objects.

**When `po` fails:** Swift structs without `CustomDebugStringConvertible`, protocol-typed values (use `v` instead — it performs iterative dynamic type resolution that `po` doesn't).

### `expression` (full form)

Full expression evaluation with all options.

```
(lldb) expression self.view.backgroundColor = UIColor.red
(lldb) expression self.debugFlag = true
(lldb) expression myArray.append("test")
(lldb) expression CATransaction.flush()           # Force UI update
(lldb) expression Self._printChanges()             # SwiftUI debug
```

**Flags:**

| Flag | Effect |
|------|--------|
| `-l objc` | Evaluate as Objective-C |
| `-l swift` | Evaluate as Swift (default) |
| `-O` | Object description (same as `po`) |
| `-i false` | Stop on breakpoints hit during evaluation (default: ignore) |
| `--` | Separator between flags and expression |

**ObjC expressions for Swift debugging:**

```
(lldb) expr -l objc -- (void)[[[UIApplication sharedApplication] keyWindow] recursiveDescription]
(lldb) expr -l objc -- (void)[CATransaction flush]
(lldb) expr -l objc -- (int)[[UIApplication sharedApplication] _isForeground]
```

### `register read`

Low-level register inspection:

```
(lldb) register read
(lldb) register read x0 x1                # Specific registers (ARM64)
(lldb) register read --all                # All register sets
```

---

## Part 2: Breakpoints

### Setting Breakpoints

```
(lldb) breakpoint set -f File.swift -l 42                # File + line
(lldb) b File.swift:42                                    # Short form
(lldb) breakpoint set -n methodName                       # By function name
(lldb) breakpoint set -n "MyClass.myMethod"               # Qualified name
(lldb) breakpoint set -S layoutSubviews                   # ObjC selector
(lldb) breakpoint set -r "viewDid.*"                      # Regex on name
(lldb) breakpoint set -a 0x100abc123                      # Memory address
```

### Conditional Breakpoints

```
(lldb) breakpoint set -f File.swift -l 42 -c "value == nil"
(lldb) breakpoint set -f File.swift -l 42 -c "index > 100"
(lldb) breakpoint set -f File.swift -l 42 -c 'name == "test"'
```

### Ignore Count

```
(lldb) breakpoint set -f File.swift -l 42 -i 50          # Skip first 50 hits
```

### One-Shot Breakpoints

```
(lldb) breakpoint set -f File.swift -l 42 -o             # Delete after first hit
```

### Breakpoint Commands (Logpoints)

Add commands that execute when breakpoint hits:

```
(lldb) breakpoint command add 1
> v self.state
> p self.items.count
> continue
> DONE
```

Or in one line:

```
(lldb) breakpoint command add 1 -o "v self.state"
```

### Exception Breakpoints

```
(lldb) breakpoint set -E swift                            # All Swift errors
(lldb) breakpoint set -E objc                             # All ObjC exceptions
# Filtering by exception name requires Xcode's GUI (Edit Breakpoint → Exception field)
```

### Symbolic Breakpoints

```
(lldb) breakpoint set -n UIViewAlertForUnsatisfiableConstraints    # Auto Layout
(lldb) breakpoint set -n "-[UIApplication _run]"                    # App launch
(lldb) breakpoint set -n swift_willThrow                            # Swift throw
```

### Managing Breakpoints

```
(lldb) breakpoint list                     # List all
(lldb) breakpoint list -b                  # Brief format
(lldb) breakpoint enable 3                 # Enable breakpoint 3
(lldb) breakpoint disable 3                # Disable breakpoint 3
(lldb) breakpoint delete 3                 # Delete breakpoint 3
(lldb) breakpoint delete                   # Delete ALL (asks confirmation)
(lldb) breakpoint modify 3 -c "x > 10"    # Add condition to existing
```

### Watchpoints

Break when a variable's memory changes:

```
(lldb) watchpoint set variable self.count                  # Watch for write
(lldb) watchpoint set variable -w read_write myGlobal      # Watch for read or write
(lldb) watchpoint set expression -- &myVariable            # Watch memory address
(lldb) watchpoint list                                     # List all
(lldb) watchpoint delete 1                                 # Delete watchpoint 1
(lldb) watchpoint modify 1 -c "self.count > 10"            # Add condition
```

**Note:** Hardware watchpoints are limited (~4 per process). Use sparingly.

---

## Part 3: Thread & Backtrace

### Backtraces

```
(lldb) bt                              # Current thread backtrace
(lldb) bt 10                           # Limit to 10 frames
(lldb) bt all                          # All threads
(lldb) thread backtrace all            # Same as bt all
```

### Thread Navigation

```
(lldb) thread list                     # List all threads with state
(lldb) thread info                     # Current thread details + stop reason
(lldb) thread select 3                 # Switch to thread 3
```

### Frame Navigation

```
(lldb) frame info                      # Current frame details
(lldb) frame select 5                  # Jump to frame 5
(lldb) up                              # Go up one frame (toward caller)
(lldb) down                            # Shortcut: go down one frame
```

### Thread Return (Skip Code)

Force an early return from the current function:

```
(lldb) thread return                   # Return void
(lldb) thread return 42                # Return specific value
```

**Use with caution** — skips cleanup code, can leave state inconsistent.

---

## Part 4: Expression Evaluation

### Swift Expressions

```
(lldb) expr let x = 42; print(x)
(lldb) expr self.view.backgroundColor = UIColor.red
(lldb) expr UIApplication.shared.windows.first?.rootViewController
(lldb) expr UserDefaults.standard.set(true, forKey: "debug")
```

### Objective-C Expressions

Switch to ObjC when Swift expression parser fails:

```
(lldb) expr -l objc -- (void)[CATransaction flush]
(lldb) expr -l objc -- (id)[[UIApplication sharedApplication] keyWindow]
(lldb) expr -l objc -- (void)[[NSNotificationCenter defaultCenter] postNotificationName:@"test" object:nil]
```

### UI Debugging Expressions

```
(lldb) expr -l objc -- (void)[[[UIApplication sharedApplication] keyWindow] recursiveDescription]
(lldb) po UIApplication.shared.windows.first?.rootViewController?.view.recursiveDescription()
```

### SwiftUI Debugging

```
(lldb) expr Self._printChanges()                # Print what triggered body re-eval (inside view body only)
```

### Runtime Type Information

```
(lldb) expr type(of: someValue)
(lldb) expr String(describing: type(of: someValue))
```

---

## Part 5: Process Control

### Execution Control

```
(lldb) continue                        # Resume execution (c)
(lldb) c                               # Short form
(lldb) process interrupt               # Pause running process
(lldb) thread step-over                # Step over (n / next)
(lldb) n                               # Short form
(lldb) thread step-in                  # Step into (s / step)
(lldb) s                               # Short form
(lldb) thread step-out                 # Step out (finish)
(lldb) finish                          # Short form
(lldb) thread step-inst                # Step one instruction (assembly-level)
(lldb) ni                              # Step over one instruction
```

### Process Management

```
(lldb) process launch                  # Launch/restart
(lldb) process attach --pid 1234       # Attach to running process
(lldb) process attach --name MyApp     # Attach by name
(lldb) process detach                  # Detach without killing
(lldb) kill                            # Kill debugged process
```

---

## Part 6: Memory & Image

### Memory Reading

```
(lldb) memory read 0x100abc123                    # Read memory at address
(lldb) memory read -c 64 0x100abc123              # Read 64 bytes
(lldb) memory read -f x 0x100abc123               # Format as hex
(lldb) memory read -f s 0x100abc123               # Format as string
```

### Memory Search

```
(lldb) memory find -s "searchString" -- 0x100000000 0x200000000
```

### Image/Module Inspection

```
(lldb) image lookup -a 0x100abc123                # Lookup symbol at address
(lldb) image lookup -n myFunction                 # Find function by name
(lldb) image lookup -rn "MyClass.*"               # Regex search
(lldb) image list                                 # List all loaded images/frameworks
(lldb) image list -b                              # Brief format
```

**Common use:** Finding which framework a crash address belongs to:

```
(lldb) image lookup -a 0x1a2b3c4d5
```

---

## Part 7: .lldbinit & Customization

### File Location

LLDB reads `~/.lldbinit` at startup. Per-project init files are also supported when configured in Xcode's scheme settings.

### Useful Aliases

Add to `~/.lldbinit`:

```
# Quick reload — flush UI changes made via expression
command alias flush expr -l objc -- (void)[CATransaction flush]

# Print view hierarchy
command alias views expr -l objc -- (void)[[[UIApplication sharedApplication] keyWindow] recursiveDescription]

# Print auto layout constraints
command alias constraints po [[UIWindow keyWindow] _autolayoutTrace]
```

### Custom Type Summaries

```
# Show CLLocationCoordinate2D as "lat, lon"
type summary add CLLocationCoordinate2D --summary-string "${var.latitude}, ${var.longitude}"
```

### Settings

```
(lldb) settings show target.language              # Current language
(lldb) settings set target.language swift          # Force Swift mode
(lldb) settings set target.max-children-count 100  # Show more collection items
```

### Per-Project .lldbinit

In Xcode: Edit Scheme → Run → Options → "LLDB Init File" field.

Put project-specific aliases and breakpoints in a `.lldbinit` file in your project root.

---

## Part 8: Troubleshooting LLDB Itself

### "expression failed to parse"

**Cause:** Swift expression parser can't resolve types from the current module.

**Fixes:**
1. Use `v` instead (no compilation needed)
2. Simplify the expression
3. Try `expr -l objc -- ...` for ObjC-bridge types
4. Clean derived data and rebuild

### "variable not available"

**Cause:** Compiler optimized the variable out.

**Fixes:**
1. Switch to Debug build configuration
2. Set `-Onone` for the specific file (Build Settings → per-file compiler flags)
3. Use `register read` to check if the value is in a register

### "wrong language mode"

**Cause:** LLDB defaults to ObjC in some contexts (especially in frameworks).

**Fix:**
```
(lldb) settings set target.language swift
(lldb) expr -l swift -- mySwiftExpression
```

### "expression caused a crash"

**Cause:** The expression you evaluated had a side effect that crashed.

**Fix:**
1. Don't evaluate expressions that modify state unless you intend to
2. Use `v` for read-only inspection
3. If the crash corrupted state, restart the debug session

### LLDB Hangs or Is Slow

**Cause:** Usually compiling a complex expression or resolving types in a large project.

**Fix:**
1. Use `v` instead of `p`/`po` (no compilation)
2. Reduce expression complexity
3. If LLDB hangs during `po`, Ctrl+C to cancel and use `v` instead

### Breakpoint Not Hit

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| Wrong file/line (code moved) | Re-set breakpoint on current code |
| Breakpoint disabled | `breakpoint enable N` |
| Code not executed | Verify the code path is reached |
| Optimized out (Release) | Switch to Debug configuration |
| In a framework/SPM package | Set symbolic breakpoint by function name |

---

## Resources

**WWDC**: 2019-429, 2018-412, 2022-110370, 2015-402

**Docs**: /xcode/stepping-through-code-and-inspecting-variables-to-isolate-bugs, /xcode/setting-breakpoints-to-pause-your-running-app

**Skills**: axiom-lldb, axiom-xcode-debugging
