---
name: siri
description: Siri AI readiness audit, build, metadata analyzer, App Skills (Xcode 27.3)
disable-model-invocation: true
argument-hint: "[scheme]"
---

# Siri AI Readiness Loop

Runs the loop Apple's tooling expects for the Siri AI Developer Preview (Xcode 27.3+): audit the source, build, analyze the built metadata, check that App Skills compiled, then set up SiriEvaluations. Uses `axiom-integration (skills/siri-ai.md)` for every fix.

## Steps

1. **Toolchain.** Confirm `xcrun -f sirimetadataanalyzer` resolves. If it doesn't, the selected developer directory is an Xcode older than 27.3 or the Command Line Tools (`xcode-select -p`): say so and stop (only the source audit in step 2 applies).
2. **Source audit.** Launch the `siri-ai-auditor` agent (or follow `axiom-integration (skills/siri-ai-auditor.md)` inline). Fix CRITICAL findings before building; a cold-launch dependency crash or a generable-entity error makes later steps meaningless.
3. **Build.** Build the app scheme (argument, or the app target's scheme) following `axiom-build`'s "Capture Build and Test Diagnostics": run the xcodebuild inventory first and build through axbuild. App Intents metadata errors come from the `ExtractAppIntentsMetadata` phase and halt export (`no AppIntents metadata have been exported`); fix them before step 4, because the analyzer would read the previous build.
4. **Analyze.** Find the product with `xcodebuild -showBuildSettings -scheme <scheme>` (`BUILT_PRODUCTS_DIR`, `FULL_PRODUCT_NAME`), then run `xcrun sirimetadataanalyzer <App.app> --format json`. Exit `0` = no errors, `2` = errors, `1` = couldn't run. Map each finding to its fix:

   | Rule | Fix in `skills/siri-ai.md` |
   |---|---|
   | `SMA109` no intent is a tool | Tool Intents; Adoption Order. Ignore it for primary-domain schema intents, which Siri already handles (`.tool` on them is a build error) |
   | `SMA202` parameter has no description | Tool Intents (metadata); skip when the title says it all |
   | `SMA203` entity property has no description | Entity Properties (fallback if the entity ships before 27.3) |
   | `SMA601` entity exposes no properties | Entity Properties; `skills/app-intents.md` (visibility) |
   | `SMA701` tool matches a system schema | Schema intents: adopt the schema or make the text app-specific |
   | anything else | Follow the finding's message; don't invent API to satisfy it |

   Run once per shipping language with `--language <code>`. Suppress a finding with `--config` only for behavior the developer chose to keep.
5. **App Skills.** If the project has a `*.skillsbundle`, confirm `Metadata.appintents/Skills.skillsc` exists in the built app (`Contents/Resources/Metadata.appintents/` on macOS). A successful build without it means the bundle isn't in Copy Bundle Resources. Any skills build error means no skills shipped.
6. **Rebuild and re-analyze** until the analyzer exits `0` and the remaining findings are deliberate.
7. **Next: SiriEvaluations.** Offer to write scenarios with `axiom-integration (skills/siri-evaluations-ref.md)`: a few per tool, `Calls(.disallowed)` for destructive intents, one `Loads(.required)` per App Skill. Gate on intents; skill loading varies run to run, so track it over several runs. Running them needs a physical Apple Intelligence device on 27.3+; ask before using any device.

## Report

- Auditor readiness score and CRITICAL/HIGH findings fixed or open
- Build result, and any metadata-export errors
- Analyzer summary line (`N intents (T tools), E entities`) and findings by rule
- Skills compiled: yes / no / none in project
- What's left before device testing

## Prefer Natural Language?

- "Is my app ready for Siri AI?"
- "Run the Siri metadata analyzer on my app"
- "Why isn't Siri using my App Skill?"
