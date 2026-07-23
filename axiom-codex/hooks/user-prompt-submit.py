#!/usr/bin/env python3
"""UserPromptSubmit hook for Axiom plugin.

Detects iOS-related prompts and injects specific skill routing instructions.

Standalone Python (matching pretool-crash-route.py / posttool-bash-hints.py) —
NOT embedded in a bash heredoc. The old user-prompt-submit.sh wrapped this in
`python3 -c "$(cat <<'EOF' ... EOF)"`, which broke under macOS bash 3.2 whenever
a prose apostrophe appeared in the body. Plain .py eliminates that bug class and
makes the logic directly lintable and testable.

Reads a JSON payload on stdin (`{"prompt": "..."}`), writes a JSON response on
stdout. Never exits non-zero — a hook failure must not block the prompt.
"""

from __future__ import annotations

import json
import os
import re
import sys

# Drain stdin FIRST — before the project gate below — so a gated-off invocation
# still consumes the prompt payload the parent wrote to our stdin. Exiting with
# the pipe undrained risks EPIPE / a pipe-buffer stall on the writer side for a
# large paste; this repo has hit that hook-stdin class before (GH #24).
try:
    input_data = json.load(sys.stdin)
    prompt = input_data.get("prompt", "")
except Exception:
    print("{}")
    sys.exit(0)

if not prompt or len(prompt) < 5:
    print("{}")
    sys.exit(0)

# Project-type gate (GH #48). session-start.py already skips non-Apple projects
# and honors AXIOM_SESSION_CONTEXT; this hook did not, so it fired routing on
# every prompt in every repo — injecting Axiom skill suggestions into Python,
# docs, and other non-Apple projects even with AXIOM_SESSION_CONTEXT=never set.
# Fail-open in BOTH directions: a missing module or a detection error falls
# through to keyword matching rather than silencing a real Apple project
# (resolve_context_decision is itself fail-open). CPython already puts this
# script's own dir on sys.path[0] regardless of cwd, so the sibling import
# normally resolves; the explicit insert only hardens the unusual invocation
# (-c / -m / symlink) where sys.path[0] is not this file's directory.
_hook_dir = os.path.dirname(os.path.abspath(__file__))
if _hook_dir not in sys.path:
    sys.path.insert(0, _hook_dir)
try:
    from project_detect import resolve_context_decision

    if not resolve_context_decision(os.getcwd(), os.environ.get("AXIOM_SESSION_CONTEXT")):
        print("{}")
        sys.exit(0)
except Exception:
    pass  # fail-open: detection unavailable → proceed with keyword matching

# Cap at 2000 chars — iOS keywords appear early, avoids regex on huge pastes
prompt_lower = prompt[:2000].lower()

# --- Router matching ---
# Patterns are iOS-specific to avoid false positives on generic dev work

matches = []

# Negative gate (recall-favoring — axiom-zfpv).
#
# On Claude Code this hook is one of TWO routing layers. The other is Claude Code's
# own matcher over the claude-code.json skill descriptions — high-recall, with no
# negative gate. This hook is the high-precision layer. The gate is deliberately
# kept from being MORE aggressive than the description layer (which would make
# hook-routing strictly worse than no hook — backwards): a non-iOS keyword only
# suppresses routing when NO positive iOS signal is also present. So
# "xcodebuild fails because of a Python script" or "port this Android layout to
# SwiftUI" still routes — the iOS signal counterbalances the non-iOS keyword. A
# pure non-iOS prompt (no iOS signal) stays gated. This is an intentional
# precision-vs-recall trade; see TestMixedSignalRouting before tightening it.
#
# ios_signal is a CURATED high-confidence subset — intentionally NOT a mirror of
# the per-router token lists below. Inclusion criterion: a token that is
# unambiguously Apple-only (swift/swiftui/xcode/an Apple platform/uikit/xcrun/...)
# OR whose only realistic misfire is a benign over-suggestion. Deliberately
# EXCLUDED: tokens that also name common non-Apple things — bare "simulator"
# (circuit/flight sim), "provisioning" (DevOps), "code sign" (Authenticode), "spm"
# (neuroimaging / a Linux pkg mgr), "derived data". Accepted consequence (documented,
# not accidental): a mixed prompt whose ONLY iOS signal is an excluded gated-rule
# token (e.g. "code sign" + "python") stays gated here; on Claude Code the
# description layer still routes it. When adding a new router token below, only add
# it here too if it clears the inclusion criterion.
non_ios_keyword = re.search(r'typescript|react(?!\s*native)|angular|vue\.js|django|flask|rails|node\.js|nodejs|npm |yarn |webpack|docker|kubernetes|python\b|java\b(?!script)|kotlin|android|flutter|unreal|godot|steam\s*deck|shopify|woocommerce|\bsaas\b|\brust\b|golang|\bgo\s+(module|routine)|electron|deno|\bphp\b|laravel|symfony|\bruby\b|\brails\b|elixir|dotnet|\.net\b|asp\.net|\bc#|csharp|svelte|nuxt|next\.js|nextjs|express\.js|expressjs|spring\s*boot', prompt_lower)
ios_signal = re.search(r'\bswift\b|swiftui|swiftdata|\bxcode|xcworkspace|xcodeproj|\bobjective-c\b|\bobjc\b|\bios\b|ipados|watchos|tvos|visionos|\biphone|\bipad|apple\s*(watch|tv)|vision\s*pro|uikit|appkit|cocoapod|swift\s*package|testflight|app\s*store\s*connect|provisioning\s*profile|\bxcrun\b|\blldb\b', prompt_lower)
non_ios = bool(non_ios_keyword) and not ios_signal

# Build/environment (highest priority)
if not non_ios and re.search(r'build (fail|error|broken)|xcodebuild|simulator (crash|hang|won.t|not )|pod (install|update)|spm |swift package|linker (error|command)|module.{0,5}not found|derived data|code sign|provisioning|xcworkspace|xcodeproj|xcode (error|crash|hang|won.t)|build time|compile (error|slow|time)|lldb\b|breakpoint.{0,10}(set|conditional|symbolic)|thread\s*backtrace|\bpo\b.{0,10}(vs|variable|expression)|transport error|could not be established|\bcoredevice\b|dvtenablecoredevice|deploy(ing|ed)?.{0,30}(to\s+)?(device|watch|phone|ipad|simulator|hardware|real\s+device|physical\s+device)|connect.{0,10}(to.{0,10})?(watch|device|phone|ipad|simulator)|device.{0,10}(not.{0,10}(connect|found|recogn|appear)|won.t.{0,10}(connect|appear|show))|cannot find symbol|cannot find.{0,15}in scope|use of unresolved identifier|undefined (symbol|reference)|works? (fine )?(in|on) (the )?simulator.{0,40}(fail|crash|broken|wrong|black|empty|hang).{0,15}(on|in).{0,10}(real |physical )?device|(crash|fail|broken|wrong|black|empty|hang)\w*\s+only\s+on\s+.{0,15}device|only\s+(crash|fail|broken|hang)\w*\s+(on|in)\s+.{0,15}device|(real|physical)\s*device[- ]only|device[- ]only.{0,15}(crash|fail|broken)|after .{0,30}(updating|upgrading|installing) xcode', prompt_lower):
    matches.append("axiom-build")

# UI
if re.search(r'swiftui|@state\b|@binding\b|@observable\b|@environment\b|navigationstack|navigationsplitview|layout.{0,10}(break|bug|wrong|issue)|preview.{0,5}(crash|fail|not |won.t|broken)|view.{0,10}(not|won.t|doesn.t).{0,10}(updat|render|show|appear)|tabview|scroll.{0,20}(jank|lag|slow|stutter)|presentationdetents?|\bdetents?\b|presentation(compactadaptation|sizing|backgroundinteraction)|popover.{0,20}(sheet|iphone|compact|anchor)|sheet.{0,20}(detent|resiz|medium|half|landscape.{0,15}full)|onhover|hovereffect|oncontinuoushover|pointerstyle', prompt_lower):
    matches.append("axiom-swiftui")

# UI — preview construction (separate from preview-crash routing above)
# Routes to axiom-swiftui for building good previews, perf, @Previewable, PreviewModifier, variant matrix
if "axiom-swiftui" not in matches and re.search(r'@previewable\b|previewable\s*\(\s*\)|previewmodifier|makesharedcontext|preview.{0,15}(slow|takes? \w+ seconds?|takes? forever|too slow|hang|never finish)|slow.{0,10}preview|#preview\b|preview\s+(variant|matrix|trait|modifier|canvas)|variant\s*mode|preview\s*pin|xcode_running_for_previews|development assets|sizethatfitslayout', prompt_lower):
    matches.append("axiom-swiftui")

# UI — generic terms gated by non_ios check
# Note: bare "toolbar" matches NSToolbar in macOS prompts — require \. prefix or modifier-context
if not non_ios and "axiom-swiftui" not in matches and re.search(r'animation.{0,5}(not|won.t|broken|stutter|jank)|\.toolbar\b|toolbaritem|toolbarplacement|\.sheet|\.fullscreencover|list\b.{0,10}(scroll|slow|performance)', prompt_lower):
    matches.append("axiom-swiftui")

# Data
if re.search(r'swiftdata|core\s*data|@model\b|@query\b|@relationship\b|modelcontainer|modelcontext|cloudkit|ckrecord|cksyncengine|ckerror|ckshare|ckdatabase|ckcontainer|ckoperation|grdb|codable\b|nsmanagedobject|fetchrequest', prompt_lower):
    matches.append("axiom-data")

# Data — generic terms gated
if not non_ios and "axiom-data" not in matches and re.search(r'migration.{0,10}(crash|fail|data|schema|version)|sqlite\b|sqlitedata|@table\b.{0,10}(macro|column|model)|realm|schema.{0,5}(change|evolv|version)|foreign key constraint|no such column', prompt_lower):
    matches.append("axiom-data")

# Concurrency
if re.search(r'actor[\s-]isolated|sendable|@mainactor|data race|strict concurrency|swift 6.{0,5}concurren|task\s*\{|taskgroup|async\s+(let|sequence|stream)|nonisolated|global\s*actor|concurren.{0,5}(error|warning|violat|issue)|assumeisolated|@preconcurrency|@concurrent\b|@isolated\(', prompt_lower):
    matches.append("axiom-concurrency")

# Concurrency — runtime isolation crash signatures
if "axiom-concurrency" not in matches and re.search(r'_dispatch_assert_queue_fail|_swift_task_checkisolated|swift_task_checkisolated|dispatch_assert_queue|isolation inheritance', prompt_lower):
    matches.append("axiom-concurrency")

# Concurrency — Core Data/SwiftData threading error signals (cross-fires with axiom-data)
# These errors are fundamentally isolation/threading bugs, but the user typically pastes
# only the persistence-layer error message. Catch them so users get both routers.
if "axiom-concurrency" not in matches and re.search(r'different contexts|illegal attempt to establish a relationship|cross.{0,10}context.{0,10}thread|_pfcallcontext|_pfassertsafe', prompt_lower):
    matches.append("axiom-concurrency")

# Concurrency — generic terms gated
# UI-freeze symptoms (long async work blocking caller) — high signal for "ran on main" misuse.
if not non_ios and "axiom-concurrency" not in matches and re.search(r'main thread.{0,10}(block|freeze|hang|busy)|block.{0,15}main thread|(freeze|hang|stuck|frozen).{0,15}(ui|the ui|interface|screen)|(ui|the ui|interface|screen|app)\s+(freeze|hang|stuck|frozen)|freezes the (ui|app|screen|view)', prompt_lower):
    matches.append("axiom-concurrency")

# Performance
if re.search(r'memory leak|retain cycle|instruments\b.{0,10}(profil|trace|template)|time profiler|allocations\b.{0,5}(instrument|tool|track)|app launch.{0,5}(time|perf|slow|template|instrument)|launch times?\b|mergeable\s+librar|pre-?main\b|dyld\b|static initializer|first frame|extended launch|xctapplicationlaunchmetric|mxapplaunchmetric|\bcold launch\b|\bwarm launch\b|\b\d{1,3}\s*fps\b|drops?.{0,10}to.{0,5}\d+\s*fps|frame\s*rate.{0,15}(drop|low|stutter|janky|tank)|fps.{0,10}(drop|low|stutter|tank)|metrickit|mxmetric\w*|mxdiagnostic\w*|\bmetricmanager\b|statereporting|reportablemetadata|state reporter\b|per-?state metrics|crashreportextension|crash\s*report(er|ing)?\s*extension|crashedprocess|(top functions|run comparisons?).{0,40}(instruments?\b|profil|trace)|(instruments?\b|profil|trace).{0,40}(top functions|run comparisons?)', prompt_lower):
    matches.append("axiom-performance")

# Performance — generic terms gated
if not non_ios and "axiom-performance" not in matches and re.search(r'performance.{0,10}(slow|issue|bad|poor)|profil.{0,5}(app|cpu|memory)|battery drain|energy.{0,5}(issue|audit)|memory.{0,5}(grow|pressure|warning)|(slow|slug|sluggish).{0,15}(launch|startup)|launch.{0,15}(slow|sluggish|regress|too long)|startup.{0,5}(time|slow|perf)|(optimi[sz]e|speed\s*up)\w*\b.{0,15}\blaunch(?!\s*(day|date|week|checklist|e-?mail|plan|campaign|part(y|ner)|timeline|event|strateg|announce|cost|price|config|window|template|script|argument|option|flag|funnel|customer))\b|(optimi[sz]e|speed\s*up|reduce|trim|shorten|improve|cut|fix)\w*\b.{0,25}\b(app|application|cold|warm|first|initial)\s+(launch|start-?up)\b|(optimi[sz]e|speed\s*up|reduce|trim|shorten|improve)\w*\b.{0,25}\blaunch\s*(times?|path|phase|speed|perf\w*|sequence)\b|\bapp\w*\b.{0,30}\d+\s*(ms|sec\w*|second\w*|minute\w*)\s+to\s+launch\b|slow.{0,20}(after|when).{0,5}(tapping|tap).{0,15}(push|notification)|state reporting\b', prompt_lower):
    matches.append("axiom-performance")

# Networking
if re.search(r'urlsession|network\.framework|networkconnection\b|nwconnection\b|nwlistener', prompt_lower):
    matches.append("axiom-networking")

# Networking — generic terms gated
if not non_ios and "axiom-networking" not in matches and re.search(r'api.{0,5}(call|request|endpoint|fail)|http.{0,5}(request|error|status|timeout)|websocket|tls.{0,5}(handshake|error|fail)|certificate.{0,5}(pin|trust|error)', prompt_lower):
    matches.append("axiom-networking")

# Testing
if re.search(r'xctest|xcuitest|swift\s*testing|@test\b|@suite\b|#expect\b|ui\s*test.{0,10}(fail|flak|slow|crash|record)|test.{0,10}(without simulator|faster|speed)', prompt_lower):
    matches.append("axiom-testing")

# Integration
if re.search(r'widgetkit|widgetcenter|reloadalltimelines|reloadtimelines|add.{0,10}widget|widget.{0,10}(timeline|entry|not updat|show|display)|widget.{0,30}(not updat|never updat|stale)|siri\b|storekit|in-app purchase|iap\b|subscription\s*group|eventkit|ekevents|reminder.{0,5}(access|permiss)|cncontact|app\s*intent|app\s*shortcut|spotlight.{0,5}(index|search)|spotlightsearchtool|localization|string\s*catalog|live\s*activit|control\s*center.{0,5}(widget|control)|push\s*notif|background\s*task|bgtask|timer.{0,5}(pattern|crash|dispatch)|accessorysetupkit|asaccessorysession|asdiscoverydescriptor|accessory\s*(setup|pairing|picker)|weatherkit|weatherservice|callkit|cxprovider|pushkit|pkpushregistry|voip\s*(push|call|app)|livecommunicationkit|conversationmanager|cxcalldirectory|caller\s*id|call\s*directory|livecalleridlookup|assetpack\w*|ba-package|ba-serve|nsbundleresourcerequest|storedownloaderextension|badownloaderextension|pricingterms|billingplantype|commitmentinfo|redeemoption|offercoderedemption|presentoffercoderedeemsheet|bluetooth\s*channel\s*sounding|channelsounding|startchannelsoundingsession|cbchannelsounding', prompt_lower):
    matches.append("axiom-integration")

# Integration — generic asset/commerce phrases gated
# Spaced forms of the OS27 StoreKit/Background Assets vocabulary. Zero-space API
# tokens live ungated above; these phrase forms also appear in web/marketing/SaaS
# prompts, so they take the non_ios gate plus purchase/asset-context proximity.
if not non_ios and "axiom-integration" not in matches and re.search(r'background\s*assets\b|asset\s*packs?\b|apple\s*unity\s*plug|on.?demand\s*resources?\b.{0,50}(deprecat|migrat|asset|tag|bundle|ios|xcode|app\s*store|background\s*assets)|(deprecat\w*|migrat\w*|odr)\b.{0,40}on.?demand\s*resources|retention\s*messag\w*.{0,60}(subscription|cancel|app\s*store|storekit)|(subscription|cancel\w*|storekit|app\s*store).{0,60}retention\s*messag|billing\s*plan.{0,40}(subscription|commitment|iap|in.app|storekit|app\s*store)|(subscription|commitment|iap|in.app|storekit|app\s*store).{0,40}billing\s*plan|(subscription|monthly|plan)s?\b.{0,40}12.?month\s*commitment|12.?month\s*commitment.{0,40}(subscription|monthly|plan)|offer\s*codes?\b.{0,40}(redeem|redemption|storekit|app\s*store|iap|in.app|sheet)|(redeem|redemption)\w*.{0,30}offer\s*codes?\b', prompt_lower):
    matches.append("axiom-integration")

# Media
if re.search(r'avcapture|phpicker|photospicker|photo.{0,5}(library|picker|capture)|core\s*haptics|haptic|now\s*playing|shazamkit|audio\s*recogni|avfoundation|carplay.{0,12}(audio|now|map\s*panel|charging|mini\s*player|overlay)|cpmappanel|allowsminiplayer|cpchargingstation|musickit|camera.{0,5}(capture|preview|session|app|launch)|front\s*camera|center\s*stage|deferred\s*start|pro\s*video\s*storage|prores\b|smart\s*framing|dockkit|dockaccessory|dock\s*accessory|motorized.{0,12}(stand|dock)', prompt_lower):
    matches.append("axiom-media")

# Accessibility
if re.search(r'voiceover|accessibility.{0,10}(label|hint|trait|value|issue|audit|fix)|dynamic type|color contrast|wcag|a11y|accessib.{0,10}(element|identif|action)|speak\s*screen|spoken\s*content|accessibility\s*reader|larger\s*text\b|accessibility\s*nutrition|\bdirect\s*touch|activation\s*point|(subtitle|caption)\s*(styl|font|color|appearance|preview)|generated\s*subtitle|(subtitle|caption)s?.{0,15}(video|player|avplayer)', prompt_lower):
    matches.append("axiom-accessibility")

# AI
if re.search(r'foundation models|apple intelligence|@generable\b|languagemodelsession|on-device.{0,5}(ai|model|ml)|@guide\b.{0,10}(generat|struct)|private\s*cloud\s*compute|privatecloudcompute', prompt_lower):
    matches.append("axiom-ai")

# AI evaluations (Evaluations framework). Framework-specific tokens fire ungated;
# bare "eval" wording needs AI/model context or it swallows "evaluate my architecture".
if "axiom-ai" not in matches and re.search(r'evaluations\s*framework|import\s+evaluations|\.evaluates\b|modeljudgeevaluator|toolcallevaluator|evaluatorsbuilder|metricsaggregator|trajectoryexpectation|toolexpectation|argumentmatcher|samplegenerator|(model|llm)[\s-]*as[\s-]*(a[\s-]*)?judge|judge\s*drift|hill[\s-]?climb|\beval\w*\b.{0,40}(prompt|model|llm|\bai\b|generat|intelligen|summariz|inference|tool\s*call|trajector|agent)|(prompt|model|llm|\bai\b|generat|intelligen|summariz).{0,40}\beval\w*\b|(prompt|instruction|schema|model)\s*change.{0,40}(better|worse|improv|regress|help)|(better|worse|improv|regress).{0,40}(prompt|instruction|schema)\s*change|(regression|quality)\s*suite.{0,30}(\bai\b|model|prompt|llm|generat)', prompt_lower):
    matches.append("axiom-ai")

# Evaluations diagnostics — the framework fails SILENTLY, so the symptom phrasings
# look nothing like "write an eval suite". These are unambiguous enough to fire ungated.
if "axiom-ai" not in matches and re.search(r'aggregatevalue|subjectinferenceerror|evaluatorerrors|missingtranscript|evaluationcontext|structuredtranscript|cohen.{0,3}s?\s*kappa|quadratic.{0,10}kappa|samplingmode|\bgreedy\s*sampling|private.?cloud.?compute.{0,30}entitlement|unsupported\s+recursion.{0,30}evaluators|(metric|score|aggregate)\w*.{0,25}(returns?|reads?|is)\s*[-−]\s*1\b|pass\s*rate.{0,30}(went|going|goes)\s*up|(score|pass\s*rate)\w*.{0,30}(went|go|goes)\s*up.{0,30}(harder|hard|adversarial|edge)', prompt_lower):
    matches.append("axiom-ai")

# ML
if re.search(r'coreml|core\s*ml|mltensor|create\s*ml|mlmodel|convert.{0,10}(pytorch|tensorflow|onnx).{0,10}(coreml|ios)|model.{0,10}(quantiz|compress|palettiz)|speech.{0,5}(recogni|analyz|to.text)', prompt_lower):
    matches.append("axiom-ai")

# Speech / transcription (Speech framework: SpeechAnalyzer, SpeechTranscriber).
# The ML regex above only fires on the literal token `speech` followed by recogni/analyz/to-text,
# so the most common entry points fell straight through — `SpeechTranscriber` does not match it,
# and neither does "transcribe mic audio". Symptom phrasings for this framework rarely contain the
# word "speech" at all, which is exactly how the OS27 Speech delta shipped behind a shut door
# (9 of 11 representative prompts were NO MATCH at v27.0.0-beta.21).
#
# Split deliberately in two: zero-space API tokens are unambiguous and stay ungated, while
# `transcrib`/`transcription`/`dictation` are ordinary English words and MUST sit behind
# `not non_ios` like every other generic-term rule in this file — otherwise "transcribe audio with
# Whisper in Python" and "add dictation to our React app" route to axiom-ai.
# `speechanalyzer` is intentionally absent: the ML rule above already matches it (`speech`+`analyz`).
if "axiom-ai" not in matches and re.search(
    r'speechtranscriber|speechdetector|dictationtranscriber'
    r'|insufficientresources|cannotconfigureaudiosystem'
    r'|captureinputsequenceprovider|assetinputsequenceprovider|analyzerinput'
    r'|ignoresresourcelimits|assetinventory|assetinstallationrequest', prompt_lower):
    matches.append("axiom-ai")

# Speech — generic English terms gated (transcribe/dictation are not Apple-only words)
if not non_ios and "axiom-ai" not in matches and re.search(
    r'transcrib|transcription|dictation|voice\s*input|speech\s*model'
    r'|(convert|turn).{0,12}(audio|mic|microphone|recording|speech).{0,12}to.{0,5}text'
    r'|(live|real.?time|automatic).{0,10}caption', prompt_lower):
    matches.append("axiom-ai")

# Vision
if re.search(r'vision\s*framework|visionkit|vnrequest|vndetect|vnclassif|vnrecogni|vncoreml|vnimage|vngenerateforeground|vngenerateattention|subject.{0,5}(segment|lift)|hand\s*pose|body\s*pose|text\s*recogni|barcode.{0,5}(scan|detect)|document\s*scan|datascanner', prompt_lower):
    matches.append("axiom-vision")

# Games/Graphics
if re.search(r'spritekit|scenekit|realitykit|skscene|skspritenode|skphysics|realityview|arview|game.{0,5}(loop|scene|physics)|touchcontroller|tctouch|tcbutton|tcthumbstick|tccontrol|gccontroller|gcvirtualcontroller|gcspatialaccessory|extendedgamepad|gamecontroller|gcmouse|gckeyboard', prompt_lower):
    matches.append("axiom-games")

# Games — generic input terms gated
if not non_ios and "axiom-games" not in matches and re.search(r'game\s*controller|virtual\s*controller|\bgamepads?\b|spatial\s*accessor|controller.{0,12}home\s*button|touch\s*controls?\b.{0,40}(game|gaming|\bport(ed|ing)?\b|controller|thumbstick|joystick|on.?screen)|(game|gaming|\bport(ed|ing)?\b|controller|thumbstick|joystick|on.?screen).{0,40}touch\s*controls?\b', prompt_lower):
    matches.append("axiom-games")

# Graphics (Metal/GPU — separate from games)
if re.search(r'metal\b.{0,10}(shader|render|migrat|buffer|texture|pipeline)|opengl.{0,10}(migrat|metal|convert)|gpu.{0,10}(render|compute)|promoti|variable.{0,5}refresh.{0,5}rate|usdkit|usdz\b|gaussian\s*splat|metalperftrace|mtltensor|tensorops|metalfx|projective\s*texture|reverb\s*mesh|realitykit|realityview|drawablesize|cametallayer|mtkview', prompt_lower):
    matches.append("axiom-graphics")

# Graphics — generic terms gated
if not non_ios and "axiom-graphics" not in matches and re.search(r'nav(igation)?\s*mesh|neural\s*render|metal\s*tensor|\busd\b.{0,30}(file|stage|prim|layer|scene|asset|model|export|convert|composit)', prompt_lower):
    matches.append("axiom-graphics")

# App Store / Shipping
if re.search(r'app store.{0,10}(reject|review|submiss|connect|metadata)|testflight|privacy manifest|app review|export compliance|age rating|app.{0,5}(submit|upload|distribut)|app\s*clip|asset\s*librar\w*.{0,40}(app\s*store|connect|review)|(app\s*store|connect).{0,40}asset\s*librar|creative\s*assets?.{0,60}(app\s*store|connect|submi|review)|(app\s*store|connect).{0,60}creative\s*assets?|uilaunchscreen|launch\s*screen.{0,25}(requir|reject|submi|store|missing|mandat|validat)|(missing|no|without)\s+launch\s*screen', prompt_lower):
    matches.append("axiom-shipping")

# Shipping — generic commerce terms gated
if not non_ios and "axiom-shipping" not in matches and re.search(r'retention\s*messag\w*.{0,60}(subscription|cancel|app\s*store|storekit)|(subscription|cancel\w*|storekit|app\s*store).{0,60}retention\s*messag|product\s*page\s*header|volume\s*(purchas|pricing).{0,50}(subscription|seat|app\s*store|\basm\b|\babm\b|apple)|(subscription|seat\w*|app\s*store|\basm\b|\babm\b).{0,50}volume\s*(purchas|pricing)|group\s*purchas|(group|organization)s?\b.{0,20}subscription|subscription.{0,20}(group|organization)|(subscription|purchas\w*|storekit|app\s*store).{0,60}seat.{0,15}(count|pricing|assign)|seat.{0,15}(count|pricing|assign).{0,60}(subscription|purchas\w*|storekit|volume\s*pricing)', prompt_lower):
    matches.append("axiom-shipping")

# macOS
# Note: bare "macos"/"mac os" is intentionally NOT matched — it fires on host-OS
# version mentions ("on macOS 26.3"). Require intent-qualifying terms instead.
if re.search(r'mac\s*app(?:lication)?s?\b|macos.{0,15}(app|build|sandbox|develop|distribut|notariz|menubar|window|toolbar|sign)|appkit|screencapturekit|scstream\b|scshareablecontent|sccontentfilter|sccontentsharingpicker|scscreenshotmanager|screcordingoutput|nstoolbar|nsviewrepresentable|nshostingcontroller|nshostingview|nshostingmenu|nshostingscene|nsgesturerecognizerrepresentable|nsviewcontrollerrepresentable|nscontrol\b|nsstatusitem|status\s*items?\b.{0,40}(window|menu|keyboard|expand)|menu\s*bar.{0,15}status\s*item|nswindowrestoration|encoderestorablestate|nsrefreshcontroller|nstextselectionmanager|nsglasseffect|cornerconfiguration|concentric.{0,10}corner|corner.{0,12}concentric|windowgroup|menubarextra|utilitywindow|commandmenu|commandgroup|focusedscenevalue|app\s*sandbox|sandbox.{0,10}(violat|entitlement|bookmark)|security.{0,5}scoped|notariz|notarytool|developer\s*id|hardened\s*runtime|sparkle.{0,5}(update|framework|auto)|\.dmg\b|distribut.{0,10}outside|menu\s*bar.{0,5}(extra|command|item)|\bcatalyst\b|maccatalyst|designed\s*for\s*ip(?:ad|hone)|ios\s*apps?\s*on\s*(?:apple\s*silicon|mac)|isiosapponmac|tablecolumn|swiftui\s*table|multi.?column\s*table|\.inspector\b|inspector\s*(column|panel|pane)', prompt_lower):
    matches.append("axiom-macos")

# watchOS
if re.search(r'\bwatchos\b|apple\s*watch|wcsession|watchconnectivity|watch\s*connectiv|smart\s*stack.{0,10}widget|\bcomplications?\b|relevancekit|clockkit|wkapplication|wkinterface|digital\s*crown', prompt_lower):
    matches.append("axiom-watchos")

# Health & fitness (HealthKit / WorkoutKit)
if re.search(r'healthkit|hkworkout|hkliveworkout|workoutkit|hkquery|hkobserver|hkanchored|hksamplequery|hkhealthstore|hksample|hkquantity|hkcategor|hkstatistic|hkactivit|health\s*(permission|data|store)|workout\s*(session|builder|recovery|mirror|build)', prompt_lower):
    matches.append("axiom-health")

# Real-world payments (Apple Pay / Wallet / Tap to Pay)
# NOT in-app purchase / IAP — that belongs to axiom-integration
if re.search(r'apple\s*pay|pkpayment|pkpaymentauthorization|passkit|\bpkpass\b|wallet\s*pass|tap\s*to\s*pay|orders?\s*in\s*wallet|merchant\s*(id|capabilit|identifier)|payment\s*(request|network|method)|postergeneric|poster\s*generic|featuredactions|featured\s*actions?\b.{0,30}pass|pass\b.{0,30}featured\s*actions?|pass\s*designer|pkpasstemplate|\bbuildpass\b|customerengagement|codabar|pkbarcodeformat', prompt_lower):
    matches.append("axiom-payments")

# Design
if re.search(r'human interface|hig\b|liquid glass|glass\s*[-]?\s*effect\b|glasseffectcontainer|glasseffectlayer|sf symbol|symbol.{0,5}(effect|variablevalue|render)|typography.{0,10}(ios|swift|app)|design.{0,5}(system|pattern|token)|app.{0,5}(entry|onboard)|launch\s*(screen|image|storyboard)\b|app\s*launch\s*(experience|animation|sequence)\b|authentication.{0,5}(flow|screen|ui)|concentric.{0,10}(corner|rectangle)|corner.{0,12}concentric', prompt_lower):
    matches.append("axiom-design")

# UIKit
if re.search(r'uikit|uiview\b|uiviewcontroller|auto\s*layout|nslayoutconstraint|uiviewrepresentable|uihostingcontroller|combine\b.{0,10}(publisher|subscriber|sink|assign)|textkit|nstextlayoutmanager|uilabel|uitableview|uicollectionview|pencilkit|pkcanvasview|pktoolpicker|pkdrawing|apple\s*pencil|paperkit|papermarkup|uicornerconfiguration|cornerconfiguration|encoderestorablestate|iphone\s*mirroring|indirectinputevents|(uiscene)?sizerestrictions|uipointerinteraction|uihovergesture|uikeycommand|discoverabilitytitle|uiapplicationscenemanifest|scene\s*manifest', prompt_lower):
    matches.append("axiom-uikit")

# Swift language
if re.search(r'noncopyable|~copyable|consuming\s+func|borrowing\s+func|transferable\b|draggable|dropdestinat|deep\s*link.{0,5}debug|swift.{0,5}(idiom|modern|pattern|style|convention)', prompt_lower):
    matches.append("axiom-swift")

# Location
if re.search(r'core\s*location|cllocation|clmonitor|clgeocoder|mapkit|mkmap|mkannotation|mkdirection|geofenc|region\s*monitor|significant.{0,5}location|clauthorization|location.{0,5}(service|permiss|track|updat|manag|accura)|clbodyidentifiable|heading(orientation|body)|(compass|magnetic)\s*heading|trueheading|pointofinterest(category|filter)', prompt_lower):
    matches.append("axiom-location")

# Security
if re.search(r'keychain|secitem|seckey|secaccess|passkey.{0,5}(implement|add|creat|auth)|code\s*sign|provisioning\s*profile|certificate.{0,10}(sign|identity|distribut)|encrypt.{0,10}(data|file|aes|chacha)|cryptokit|secureenclave|app\s*attest|dcappattest|devicecheck|prompt\s*injection|secur.{0,25}(agentic|ai\s*agent|llm|ai\s*feature)|agentic.{0,25}(secur|risk|threat)|ontoolcall|historytransform|authenticationpolicy|lock.{0,3}screen.{0,20}(intent|siri)', prompt_lower):
    matches.append("axiom-security")

# Apple docs (iOS version uncertainty, API lookups)
if re.search(r'ios (19|2[0-9])|does.*ios.*exist|current.*ios|which ios|what.*ios.*version|wwdc.{0,5}(session|video|transcript|20\d\d)', prompt_lower):
    matches.append("axiom-apple-docs")

# Xcode MCP
if re.search(r'xcode\s*mcp|mcpbridge|xcrun\s*mcp|xcode.{0,5}(read|build|test|preview).{0,10}mcp', prompt_lower):
    matches.append("axiom-xcode-mcp")

# Device control (Device Hub, devicectl) — Xcode-independent device/simulator control
# owned by axiom-tools (skills/device-control-ref.md). Deliberately NOT bare "simctl"
# (too broad — push/openurl/location route to their own domains).
if re.search(r'device\s*hub|\bdevicectl\b|(control|drive|manage).{0,25}(simulator|device).{0,20}without.{0,10}xcode|(simulator|device).{0,20}without.{0,10}xcode\s*(run|open|is|be)', prompt_lower):
    matches.append("axiom-tools")

# --- Output ---
if not matches:
    print("{}")
    sys.exit(0)

# Limit to top 3 matches (more is noise)
matches = matches[:3]

if len(matches) == 1:
    skill = matches[0]
    context = f"Axiom: This prompt matches `{skill}`. Invoke it before responding."
else:
    skill_list = ", ".join(f"`{s}`" for s in matches)
    context = f"Axiom: This prompt matches: {skill_list}. Invoke the most relevant one(s) before responding."

output = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": context,
    }
}

print(json.dumps(output))
