# testing-auditor

Audits test quality and coverage — finds flaky patterns, identifies untested critical paths, checks for speed improvements, and evaluates Swift Testing migration readiness.

## What It Does

- Detects flaky patterns (sleep calls, shared mutable state, order-dependent tests)
- Identifies speed improvements (unnecessary Host Application, logic tests in app target)
- Finds untested critical paths (auth, payments, persistence without corresponding tests)
- Evaluates Swift Testing migration candidates and parameterization opportunities
- Checks for Swift 6 concurrency issues in test code
- Produces a Test Health Score (WELL TESTED / GAPS / UNDERTESTED)

## How to Use

**Natural language:**
- "Can you audit my tests for issues?"
- "Why are my tests flaky?"
- "How can I make my tests faster?"
- "Should I migrate to Swift Testing?"
- "What critical paths don't have tests?"

**Explicit command:**
```bash
/axiom:audit testing
```

## Related

- **swift-testing** skill — the testing patterns this auditor checks against
- **test-failure-analyzer** agent — use when a specific test fails and you need to diagnose why
- **health-check** agent — includes testing-auditor in project-wide scans
