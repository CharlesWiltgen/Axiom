---
name: run-tests
description: Run XCUITests and parse results using the test-runner agent
arguments:
  - name: scheme
    description: Test scheme name (optional - will discover available schemes if not provided)
    required: false
  - name: target
    description: Specific test class or method to run (optional)
    required: false
allowed_tools:
  - Task
---

# Run Tests Command

Runs XCUITests using the test-runner agent.

## Usage

```
/axiom:run-tests [scheme] [target]
```

## Examples

```
/axiom:run-tests
/axiom:run-tests MyAppUITests
/axiom:run-tests MyAppUITests LoginTests
/axiom:run-tests MyAppUITests LoginTests/testLoginWithValidCredentials
```

## Instructions

Launch the test-runner agent to:

1. **Discover schemes** if not provided
2. **Run tests** with the specified scheme/target
3. **Parse results** using xcresulttool
4. **Export failure attachments** (screenshots, videos)
5. **Provide analysis** with actionable fixes

<Task>
subagent_type: axiom:test-runner
prompt: |
  {{#if args.scheme}}
  Run the UI tests for scheme "{{args.scheme}}"{{#if args.target}} targeting {{args.target}}{{/if}}.
  {{else}}
  Discover available test schemes and run UI tests. Ask which scheme to use if multiple are available.
  {{/if}}

  After running tests:
  1. Parse results with xcresulttool
  2. Export failure attachments
  3. Analyze failures and provide specific fixes
  4. Show how to rerun just the failing tests
</Task>
