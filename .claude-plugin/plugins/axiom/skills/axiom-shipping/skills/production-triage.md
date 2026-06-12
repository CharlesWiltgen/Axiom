# Production Crash & Hang Triage (Sentry / ASC)

Use this skill when you have a **corpus** of grouped production issues from an aggregator (Sentry, App Store Connect) and need to classify, cluster, and prioritize them. This is the corpus-level path — not for a single local crash file.

- **Single crash file** (.ips, MetricKit, .crash) → `axiom-shipping (skills/testflight-triage.md)` or `/axiom:analyze-crash`
- **TestFlight triage via Xcode Organizer** → `axiom-shipping (skills/testflight-triage.md)`
- **This skill** → Sentry unresolved issues list, ASC aggregated crash signatures, dozens-to-hundreds of grouped issues

## The pipeline

```
Sentry / ASC aggregator
  │  (LLM fetch + normalize)
  ▼
NormalizedReport JSONL  ──(stdin)──►  xcsym triage  ──►  TriageResult JSON
                                      • classify crashes + hangs
                                      • apply noise rules
                                      • mechanical clustering
                                      • 0xdead10cc enrichment
  ▼
triage-analyzer agent
  • semantic family-merge (mechanical clusters → root-cause families)
  • impact ranking
  ▼
ranked triage report (flag-never-hide)
```

The Go side (`xcsym triage`) is a network-free pure function. It reads NormalizedReport JSONL on stdin and writes a TriageResult JSON to stdout. The LLM owns all provider auth, fetch, normalization, and semantic merging.

**The command:**

```bash
# File argument form
xcsym triage --latest-version 2.1.1 --os-floor 18.0 --min-users 5 corpus.jsonl

# Stdin form (both work)
xcsym triage --latest-version 2.1.1 --os-floor 18.0 --min-users 5 < corpus.jsonl
```

All three flags are optional. Omit any you don't need; threshold-based noise rules are silently disabled when the corresponding flag is absent.

No dSYMs required. No Xcode CLT symbolication. No network calls. Pass the JSONL, get a TriageResult.

## Fetching from Sentry

**Token:** Read from `SENTRY_AUTH_TOKEN` environment variable — never commit it, never log it, never include it in output.

### List unresolved issues

```
GET https://sentry.io/api/0/projects/{org_slug}/{proj_slug}/issues/?query=is:unresolved&statsPeriod=90d&limit=25
Authorization: Bearer $SENTRY_AUTH_TOKEN
```

Adjust `statsPeriod` (e.g., `30d`, `7d`) and add `environment=production` when needed.

### Cursor pagination — mandatory

Sentry paginates at ~25 issues per page using cursor-based links. An active app with dozens of unresolved issues will span many pages. Fetching only the first page and calling it a corpus is a correctness failure — it silently drops the majority of issues.

**Algorithm:**

1. Fetch the first page.
2. Read the `Link:` response header. It contains two entries separated by `,`:
   ```
   <https://sentry.io/api/0/...?cursor=X>; rel="previous"; results="false",
   <https://sentry.io/api/0/...?cursor=Y>; rel="next"; results="true"
   ```
3. If `rel="next"` has `results="true"`, extract its URL and fetch the next page. If `results="false"`, the cursor is exhausted — stop.
4. Accumulate results across all pages.
5. **Always log the page count** when done: `"Fetched N pages (M total issues)"`. If you hit a cap you imposed (e.g., 20-page max), state it explicitly: `"Cap hit at page 20 — corpus is partial; some issues not included."` A partial corpus is not an error, but it must be announced, never silent.

Cap example (for very large projects): stop at 20 pages and announce the cap. The user can re-run with tighter filters.

### Fetch latest event per issue

For each issue, fetch its most recent event to get the stack frames:

```
GET https://sentry.io/api/0/issues/{issue_id}/events/latest/
Authorization: Bearer $SENTRY_AUTH_TOKEN
```

From the response, extract:

| Sentry field | NormalizedReport field |
|---|---|
| `id` (issue) | `issue_id` |
| `permalink` | `issue_url` |
| `title` | `title` |
| Issue type "App Hanging" / "App Hang" | `kind: "hang"` (else `"crash"`) |
| `userCount` | `impact.users` |
| `count` (events) | `impact.events` |
| `firstSeen`, `lastSeen` | `impact.first_seen`, `impact.last_seen` |
| `tags.release` (list) | `versions.affected`, `versions.min`, `versions.max` |
| `tags.os.version` (list) | `os.versions`; `tags.os.name` → `os.platform` |
| `entries[type=exception].values[0].type` | `exception.type` |
| `entries[type=exception].values[0].mechanism.meta.signal.name` | `exception.signal` |
| `entries[type=exception].values[0].mechanism.meta.mach_exception.exception_name` | `exception.mach_exception` |
| `entries[type=threads].values` or `entries[type=exception].values[0].stacktrace` | `threads[]` |

**Frames:** Sentry frames are **bottom-up** (outermost frame first). Reverse them to get top-down (crashed frame first), matching the NormalizedReport convention. For each frame: `module`/`package` → `image`, `function` → `symbol`, `inApp` → `in_app`.

**`crashed_thread`:** Set to the index of the thread marked `crashed: true`. If ambiguous, use 0 (main thread). The adapter uses this to set `RawCrash.CrashedIdx` — every rule that inspects the crashed thread depends on it.

## Fetching from App Store Connect

Use `asc-mcp` tools when available:

| Task | asc-mcp tool |
|---|---|
| List crash signatures for a build | `metrics_build_diagnostics` |
| Download crash log detail | `metrics_get_diagnostic_logs` |

ASC crash aggregates sometimes lack individual-event frame data. When frames are unavailable, emit a **minimal NormalizedReport** with `frames_unavailable: true`:

```json
{ "provider": "asc", "issue_id": "...", "title": "...", "kind": "crash",
  "impact": { "users": 12, "events": 30 }, "frames_unavailable": true,
  "exception": { "mach_exception": "0x8badf00d" }, "threads": [] }
```

The `triage` subcommand classifies minimal reports using exception codes only (reduced confidence) rather than skipping them. Document the reduced confidence in the triage report.

## NormalizedReport shape

One JSON object per line (JSONL). Each line is one grouped issue.

**Full example — hang (idle runloop):**

```json
{
  "provider": "sentry",
  "issue_id": "POPPY-3V",
  "issue_url": "https://sentry.io/organizations/acme/issues/POPPY-3V/",
  "title": "CFRunLoopRunSpecific",
  "kind": "hang",
  "impact": { "users": 68, "events": 412, "first_seen": "2026-05-01", "last_seen": "2026-06-05" },
  "versions": { "affected": ["2.1.0", "2.1.1"], "min": "2.1.0", "max": "2.1.1" },
  "os": { "platform": "iOS", "versions": ["18.4", "26.0"] },
  "crashed_thread": 0,
  "threads": [
    {
      "index": 0,
      "crashed": true,
      "frames": [
        { "image": "libsystem_kernel.dylib", "symbol": "mach_msg2_trap", "offset": 8, "in_app": false },
        { "image": "CoreFoundation", "symbol": "CFRunLoopRun", "offset": 1234, "in_app": false }
      ]
    }
  ]
}
```

Hang events do not carry an `exception` or `termination` block — those fields are optional and omitted here. The `0xdead10cc` code (data-protection violation) belongs on `kind: "crash"` reports, not hangs.

**Full example — crash (data-protection violation, 0xdead10cc):**

```json
{
  "provider": "sentry",
  "issue_id": "POPPY-7B",
  "issue_url": "https://sentry.io/organizations/acme/issues/POPPY-7B/",
  "title": "GRDB.DatabaseError: disk I/O error",
  "kind": "crash",
  "impact": { "users": 22, "events": 89, "first_seen": "2026-05-10", "last_seen": "2026-06-04" },
  "versions": { "affected": ["2.1.1"], "min": "2.1.1", "max": "2.1.1" },
  "os": { "platform": "iOS", "versions": ["18.4"] },
  "exception": { "mach_exception": "0xdead10cc" },
  "termination": { "namespace": "RUNNINGBOARD", "code": "0xdead10cc" },
  "crashed_thread": 1,
  "threads": [
    {
      "index": 0,
      "crashed": false,
      "frames": [
        { "image": "libsystem_kernel.dylib", "symbol": "mach_msg2_trap", "offset": 8, "in_app": false }
      ]
    },
    {
      "index": 1,
      "crashed": true,
      "frames": [
        { "image": "GRDB", "symbol": "DatabaseQueue.write", "offset": 44, "in_app": true },
        { "image": "MyApp", "symbol": "HistoryStore.flush", "offset": 12, "in_app": true }
      ]
    }
  ]
}
```

**Minimal example (ASC, frames unavailable):**

```json
{ "provider": "asc", "issue_id": "ASC-001", "kind": "crash",
  "impact": { "users": 12, "events": 30 }, "frames_unavailable": true,
  "exception": { "mach_exception": "0x8badf00d" }, "threads": [] }
```

**Key points:**

- `kind` is `"crash"` or `"hang"`. The `triage` subcommand accepts both; `xcsym crash` continues to reject hangs.
- `crashed_thread` is the `index` value of the crashed thread — 0 for main thread. This is not an array position; the adapter resolves it.
- Thread objects carry no `name` field. The main thread is identified by `index: 0`; Sentry thread names are not mapped.
- `in_app` per frame is the primary app-vs-system signal. It comes from Sentry's `inApp`. Do not derive it from image-name substrings when the provider already supplies it.
- `mach_exception` carries the hex code (`0xdead10cc`, `0x8badf00d`). The adapter normalizes it to lowercase `0x…` form before matching rules — uppercase input is handled automatically.
- Frames are **top-down** in NormalizedReport (index 0 = top of stack, closest to the crash).

## Reading the TriageResult

`xcsym triage` emits a single compact JSON object to stdout:

```json
{
  "tool": "xcsym", "subcommand": "triage", "version": "...",
  "summary": { "total": 70, "crashes": 51, "hangs": 19, "skipped": 0,
               "clusters": 11, "flagged_noise": 23, "candidate_families": 6 },
  "issues": [...],
  "clusters": [...],
  "errors": [...]
}
```

### Per-issue fields

| Field | Meaning |
|---|---|
| `pattern_tag` | Crash/hang category from the rule engine (see table below) |
| `pattern_confidence` | `high`, `heuristic`, or `low` — how certain the crash/hang rule engine is (`heuristic` = pattern matched but evidence is indirect) |
| `pattern_rule_id` | The classification rule that fired (e.g., `R-swift-unwrap-01`, `H-idle-runloop-01`) |
| `cluster_key` | Mechanical signature grouping this issue with similar ones |
| `cluster_confidence` | `high` = top app frames; `low` = system-frame fallback (treat as a bag, not a cluster) |
| `noise_flags` | Array of `{class, rule_id, confidence, reason}` — empty means real-bug candidate |
| `enrichment` | Cross-skill pointers (e.g., axiom-data for 0xdead10cc + DB frames). **Omitted** when no enrichment applies — i.e. on most issues |
| `top_frames` | Top 5 frames of the crashed thread, as `"image symbol"` strings. **Omitted** when the crashed thread has no frames — e.g. an ASC aggregate emitted with `frames_unavailable: true` and no `threads[]`. Don't expect it on every issue |

`pattern_rule_id` and `noise_flags[].rule_id` are two separate fields at different nesting levels. `pattern_rule_id` (top-level on each issue) names the classification rule that matched the crash/hang pattern. Each element of `noise_flags[]` carries its own `rule_id` naming the noise rule that fired (e.g., `noise.anr_suspension.v1`). Do not conflate them.

`pattern_confidence` and `noise_flags[].confidence` use **different vocabularies**. `pattern_confidence` values are `high`, `heuristic`, or `low` (crash/hang engine). `noise_flags[].confidence` values are `high`, `medium`, or `low` (noise engine — e.g., `single_os_eol` emits `medium`).

### Noise-class table

| class | Meaning | Confidence | Action |
|---|---|---|---|
| `anr_suspension_false_positive` | Idle-runloop hang — likely background suspension, not a real block | high | Demote; the #1 issue by users may be this non-bug |
| `fixed_in_newer_build` | `versions.max` predates `--latest-version` — may already be fixed | high | Demote pending verification against the latest build |
| `third_party_or_system_only` | Crashed thread is non-main and has zero `in_app` frames — may not be directly actionable | low | Demote cautiously; a third-party SDK can crash on a value your code passed it |
| `single_os_eol` | All affected OS versions are below `--os-floor` | medium | Deprioritize for supported users |
| `long_tail_low_impact` | `impact.users` is below `--min-users` | high | Rank low, not hidden |

**`noise_flags: []`** means no noise rules fired → the issue is a real-bug candidate.

### Hang-specific pattern tags

| pattern_tag | Meaning |
|---|---|
| `anr_idle_runloop` | Main thread parked in run loop with no app work — consistent with background suspension |
| `anr_main_thread_block` | Main thread in app code or a known blocking syscall — a real block |

An `anr_idle_runloop` issue is highly likely to carry `anr_suspension_false_positive` noise. When it doesn't (e.g., the main thread has a blocking syscall buried in the window), take it seriously.

## Semantic family-merge

The `cluster_key` is a mechanical, exact-signature grouping. It is conservative by design: it never over-merges. The agent's job is to merge mechanical clusters that share a root cause and to split bags.

**Merge strategy:**

1. Read `cluster_key`, `cluster_confidence`, `pattern_tag`, and `top_frames` together for each cluster.
2. Merge clusters when: same `pattern_tag` + overlapping `top_frames` + plausible shared root cause (e.g., two nil-unwrap clusters that differ only in call site).
3. **Split `cluster_confidence: low` (marked `|sys:`) bags.** A system-frame fallback cluster lumps together unrelated issues under the same top syscall. Inspect individual `top_frames` and `pattern_tag` to split into real families. Do not present a `|sys:` cluster as a single coherent crash family.
4. Seed merges with the full frame list in `top_frames`, not just `cluster_key`.

## Flag-never-hide reporting rule

**This rule is non-negotiable.** The final triage report must include every issue — noise-flagged or not.

**Structure:**

1. **Top real-bug families** — clusters with no noise flags, ranked by `total_users` descending. Include `pattern_tag`, root-cause hypothesis, enrichment pointers, and recommended next step.
2. **Deprioritized as likely noise (review before closing)** — a dedicated section listing every noise-flagged issue with:
   - Issue ID and title
   - `noise_flags[].class` and `noise_flags[].reason`
   - User/event impact (so the reader can judge independently)
3. **Skipped (malformed or unclassifiable)** — `errors[]` from the TriageResult, if any.

**Never omit a noise-flagged issue from the report.** Omission is the correctness failure this architecture is designed to prevent — the Poppy lesson was that the #1 issue by user count was an idle-runloop suspension false-positive. A tool that silently buried it would commit the same error inverted.

**Standing note for `third_party_or_system_only`:** Always include this caveat when listing third-party-only issues as deprioritized: "A third-party SDK can crash on a nil or invalid value passed by app code — zero app frames on the crashed thread does not rule out an app-side root cause. Check for app code on other threads or higher in the call chain before dismissing."

**Standing note for `anr_suspension_false_positive`:** "This issue may represent background suspension, not a real main-thread block. Verify by checking whether the app was actively running when the hang was captured."

**Standing note for `fixed_in_newer_build`:** "A version split is rollout-exposure-blind — most events sitting on the older build is the normal shape of an incomplete rollout, not proof the bug is fixed. Before closing, verify it actually stopped on the latest build: are there still events there, and is the per-user rate flat-at-zero or *rising* as adoption grows? A flag that fired only because the newest version has little exposure yet, while crashes climb on it, is a live bug — escalate, don't close. Confirm a code change actually touched the crashing path between the two versions."

## Xcode 27 Organizer Overlap `OS27`

The Xcode 27 Organizer adds a redesigned Overview, Metric Goals calibrated against similar apps, and an agentic "Generate Recommendations" flow whose hang-fix suggestions overlap this skill's triage territory — useful as a second opinion on hang families surfaced here. Details live in axiom-performance (skills/performance-profiling.md, "Instruments 27 & Xcode 27 Organizer"); don't duplicate them into the triage pipeline.

## Resources

**Skills**: testflight-triage, axiom-data (GRDB suspension / file-protection class), axiom-performance (skills/hang-diagnostics.md, skills/performance-profiling.md — Xcode 27 Organizer)

**Tools**: xcsym (triage subcommand) — see axiom-tools (skills/xcsym-ref.md)

**Agents**: triage-analyzer
