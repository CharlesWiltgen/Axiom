---
name: foundation-models-diag
description: Context exceeded, guardrail violations, slow generation — Foundation Models diagnostics with production crisis defense
---

# Foundation Models Diagnostics

Systematic troubleshooting for Apple's Foundation Models framework with production crisis defense patterns.

## Overview

Diagnostic workflows for Foundation Models issues covering context exceeded errors, guardrail violations, slow generation, availability problems, and unexpected output. Includes production crisis scenario defense.

## When to Use This Diagnostic

Use this diagnostic when:
- Generation fails with context exceeded
- Content triggers guardrail violations
- Generation is slower than expected
- Model reports unavailable
- Output doesn't match expected format
- @Generable parsing fails
- Streaming stops mid-response
- 20% of users see errors on AI feature launch

## Diagnostic Decision Tree

### Model Won't Start
1. Check device compatibility (A17+ or M-series)
2. Verify iOS 26+ version
3. Check available disk space
4. Try after device restart

### Generation Fails

#### Context Exceeded
- Reduce input size
- Chunk large documents
- Use summarization first
- Implement sliding window

#### Guardrail Violation
- Check content for prohibited topics
- Avoid generating personal information
- Review @Guide constraints
- Consider content pre-filtering

### Output Wrong Format

#### @Generable Parsing Fails
- Verify all properties have defaults or are Optional
- Check @Guide descriptions are clear
- Simplify nested types
- Add explicit examples in prompt

#### Missing Fields
- Make fields Optional
- Provide clearer @Guide descriptions
- Use simpler types (String vs custom enum)

### Too Slow
- Profile with Instruments
- Reduce output size limits
- Use streaming for perceived performance
- Consider chunking long responses

### UI Frozen
- Use async/await properly
- Never block main thread
- Show loading state
- Implement timeout handling

## Quick Reference Table

| Symptom | Pattern | Fix |
|---------|---------|-----|
| Context exceeded | Input too large | Chunk/summarize input |
| Guardrail violation | Prohibited content | Filter input/adjust prompt |
| Parsing fails | Complex @Generable | Simplify type structure |
| Slow generation | Large output | Streaming/chunking |
| UI frozen | Main thread blocked | async/await on background |
| Unavailable | Device/OS issue | Check compatibility |

## Production Crisis Scenario

**Scenario**: AI feature launches, 20% of users see errors

### Immediate Triage (First 15 Minutes)
1. Check device distribution — errors on older devices?
2. Check error types — context exceeded vs guardrail?
3. Check input sources — specific content triggering issues?

### Quick Mitigations
- Add fallback UI for errors
- Implement retry with exponential backoff
- Cache successful responses
- Add input length validation

### Root Cause Analysis
- Review error logs by device type
- Test with production-like inputs
- Profile with Instruments on affected device class

## Pressure Defense

### When PM Demands "Just Ship It"
- Document specific failure rates
- Show user impact (crashes, bad UX)
- Propose staged rollout with monitoring

### When Tempted to Disable AI Feature
- Consider graceful degradation instead
- Add feature flags for problematic inputs
- Implement client-side guardrails

## Related Resources

- [foundation-models](/skills/integration/foundation-models) — Discipline-enforcing patterns
- [foundation-models-ref](/reference/foundation-models-ref) — Complete API reference
- [WWDC 2025/286](https://developer.apple.com/videos/play/wwdc2025/286/) — Introduction

## Documentation Scope

This is a **diagnostic skill** — systematic troubleshooting with mandatory workflows and pressure scenario defense.

**Vs Reference**: Diagnostic skills enforce workflows and handle pressure scenarios. Reference skills provide comprehensive API information.
