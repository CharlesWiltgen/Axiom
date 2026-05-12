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
import json
import re
import sys

try:
    input_data = json.load(sys.stdin)
    prompt = input_data.get("prompt", "")
except Exception:
    print("{}")
    sys.exit(0)

if not prompt or len(prompt) < 5:
    print("{}")
    sys.exit(0)

# Cap at 2000 chars — iOS keywords appear early, avoids regex on huge pastes
prompt_lower = prompt[:2000].lower()

# --- Router matching ---
# Patterns are iOS-specific to avoid false positives on generic dev work

matches = []

# Negative gate: skip prompts with strong non-iOS signals
non_ios = re.search(r'typescript|react(?!\s*native)|angular|vue\.js|django|flask|rails|node\.js|nodejs|npm |yarn |webpack|docker|kubernetes|python\b|java\b(?!script)|kotlin|android|flutter', prompt_lower)

# Build/environment (highest priority)
if not non_ios and re.search(r'build (fail|error|broken)|xcodebuild|simulator (crash|hang|won.t|not )|pod (install|update)|spm |swift package|linker (error|command)|module.{0,5}not found|derived data|code sign|provisioning|xcworkspace|xcodeproj|xcode (error|crash|hang|won.t)|build time|compile (error|slow|time)|lldb\b|breakpoint.{0,10}(set|conditional|symbolic)|thread\s*backtrace|\bpo\b.{0,10}(vs|variable|expression)|transport error|could not be established|\bcoredevice\b|dvtenablecoredevice|deploy(ing|ed)?.{0,30}(to\s+)?(device|watch|phone|ipad|simulator|hardware|real\s+device|physical\s+device)|connect.{0,10}(to.{0,10})?(watch|device|phone|ipad|simulator)|device.{0,10}(not.{0,10}(connect|found|recogn|appear)|won.t.{0,10}(connect|appear|show))', prompt_lower):
    matches.append("axiom-build")

# UI
if re.search(r'swiftui|@state\b|@binding\b|@observable\b|@environment\b|navigationstack|navigationsplitview|layout.{0,10}(break|bug|wrong|issue)|preview.{0,5}(crash|fail|not |won.t|broken)|view.{0,10}(not|won.t|doesn.t).{0,10}(updat|render|show|appear)|tabview|scroll.{0,20}(jank|lag|slow|stutter)', prompt_lower):
    matches.append("axiom-swiftui")

# UI — generic terms gated by non_ios check
# Note: bare "toolbar" matches NSToolbar in macOS prompts — require \. prefix or modifier-context
if not non_ios and "axiom-swiftui" not in matches and re.search(r'animation.{0,5}(not|won.t|broken|stutter|jank)|\.toolbar\b|toolbaritem|toolbarplacement|\.sheet|\.fullscreencover|list\b.{0,10}(scroll|slow|performance)', prompt_lower):
    matches.append("axiom-swiftui")

# Data
if re.search(r'swiftdata|core\s*data|@model\b|@query\b|@relationship\b|modelcontainer|modelcontext|cloudkit|ckrecord|cksyncengine|grdb|codable\b|nsmanagedobject|fetchrequest', prompt_lower):
    matches.append("axiom-data")

# Data — generic terms gated
if not non_ios and "axiom-data" not in matches and re.search(r'migration.{0,10}(crash|fail|data|schema|version)|sqlite\b|sqlitedata|@table\b.{0,10}(macro|column|model)|realm|schema.{0,5}(change|evolv|version)|foreign key constraint|no such column', prompt_lower):
    matches.append("axiom-data")

# Concurrency
if re.search(r'actor[\s-]isolated|sendable|@mainactor|data race|strict concurrency|swift 6.{0,5}concurren|task\s*\{|taskgroup|async\s+(let|sequence|stream)|nonisolated|global\s*actor|concurren.{0,5}(error|warning|violat|issue)|assumeisolated|@preconcurrency', prompt_lower):
    matches.append("axiom-concurrency")

# Concurrency — generic terms gated
if not non_ios and "axiom-concurrency" not in matches and re.search(r'main thread.{0,10}(block|freeze|hang|busy)|block.{0,15}main thread', prompt_lower):
    matches.append("axiom-concurrency")

# Performance
if re.search(r'memory leak|retain cycle|instruments\b.{0,10}(profil|trace|template)|time profiler|allocations\b.{0,5}(instrument|tool|track)|app launch.{0,5}(time|perf|slow|template|instrument)|launch time|pre-?main\b|dyld\b|static initializer|first frame|extended launch|xctapplicationlaunchmetric|mxapplaunchmetric|\bcold launch\b|\bwarm launch\b', prompt_lower):
    matches.append("axiom-performance")

# Performance — generic terms gated
if not non_ios and "axiom-performance" not in matches and re.search(r'performance.{0,10}(slow|issue|bad|poor)|profil.{0,5}(app|cpu|memory)|battery drain|energy.{0,5}(issue|audit)|memory.{0,5}(grow|pressure|warning)|(slow|slug|sluggish).{0,15}(launch|startup)|launch.{0,15}(slow|sluggish|regress|too long)|startup.{0,5}(time|slow|perf)|slow.{0,20}(after|when).{0,5}(tapping|tap).{0,15}(push|notification)', prompt_lower):
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
if re.search(r'widgetkit|add.{0,10}widget|widget.{0,10}(timeline|entry|not updat|show|display)|siri\b|storekit|in-app purchase|iap\b|eventkit|ekevents|reminder.{0,5}(access|permiss)|cncontact|app\s*intent|app\s*shortcut|spotlight.{0,5}(index|search)|localization|string\s*catalog|live\s*activit|control\s*center.{0,5}(widget|control)|push\s*notif|background\s*task|bgtask|timer.{0,5}(pattern|crash|dispatch)', prompt_lower):
    matches.append("axiom-integration")

# Media
if re.search(r'avcapture|phpicker|photospicker|photo.{0,5}(library|picker)|core\s*haptics|haptic|now\s*playing|shazamkit|audio\s*recogni|avfoundation|carplay.{0,5}(audio|now)|musickit|camera.{0,5}(capture|preview|session)', prompt_lower):
    matches.append("axiom-media")

# Accessibility
if re.search(r'voiceover|accessibility.{0,10}(label|hint|trait|value|issue|audit|fix)|dynamic type|color contrast|wcag|a11y|accessib.{0,10}(element|identif|action)', prompt_lower):
    matches.append("axiom-accessibility")

# AI
if re.search(r'foundation models|apple intelligence|@generable\b|languagemodelsession|on-device.{0,5}(ai|model|ml)|@guide\b.{0,10}(generat|struct)', prompt_lower):
    matches.append("axiom-ai")

# ML
if re.search(r'coreml|core\s*ml|mltensor|create\s*ml|mlmodel|convert.{0,10}(pytorch|tensorflow|onnx).{0,10}(coreml|ios)|model.{0,10}(quantiz|compress|palettiz)|speech.{0,5}(recogni|analyz|to.text)', prompt_lower):
    matches.append("axiom-ai")

# Vision
if re.search(r'vision\s*framework|vnrequest|vngenerateforeground|subject.{0,5}(segment|lift)|hand\s*pose|body\s*pose|text\s*recogni|barcode.{0,5}(scan|detect)|document\s*scan|datascanner', prompt_lower):
    matches.append("axiom-vision")

# Games/Graphics
if re.search(r'spritekit|scenekit|realitykit|skscene|skspritenode|skphysics|realityview|arview|game.{0,5}(loop|scene|physics)', prompt_lower):
    matches.append("axiom-games")

# Graphics (Metal/GPU — separate from games)
if re.search(r'metal\b.{0,10}(shader|render|migrat|buffer|texture|pipeline)|opengl.{0,10}(migrat|metal|convert)|gpu.{0,10}(render|compute)|promoti|variable.{0,5}refresh.{0,5}rate', prompt_lower):
    matches.append("axiom-graphics")

# App Store / Shipping
if re.search(r'app store.{0,10}(reject|review|submiss|connect|metadata)|testflight|privacy manifest|app review|export compliance|age rating|app.{0,5}(submit|upload|distribut)', prompt_lower):
    matches.append("axiom-shipping")

# macOS
# Note: bare "macos"/"mac os" is intentionally NOT matched — it fires on host-OS
# version mentions ("on macOS 26.3"). Require intent-qualifying terms instead.
if re.search(r'mac\s*app(?:lication)?s?\b|macos.{0,15}(app|build|sandbox|develop|distribut|notariz|menubar|window|toolbar|sign)|appkit|nstoolbar|nsviewrepresentable|nshostingcontroller|nshostingview|nsviewcontrollerrepresentable|windowgroup|menubarextra|utilitywindow|commandmenu|commandgroup|focusedscenevalue|app\s*sandbox|sandbox.{0,10}(violat|entitlement|bookmark)|security.{0,5}scoped|notariz|notarytool|developer\s*id|hardened\s*runtime|sparkle.{0,5}(update|framework|auto)|\.dmg\b|distribut.{0,10}outside|menu\s*bar.{0,5}(extra|command|item)', prompt_lower):
    matches.append("axiom-macos")

# watchOS
if re.search(r'\bwatchos\b|apple\s*watch|wcsession|watchconnectivity|watch\s*connectiv|smart\s*stack.{0,10}widget|\bcomplications?\b|relevancekit|clockkit|wkapplication|wkinterface|digital\s*crown', prompt_lower):
    matches.append("axiom-watchos")

# Health & fitness (HealthKit / WorkoutKit)
if re.search(r'healthkit|hkworkout|hkliveworkout|workoutkit|hkquery|hkhealthstore|hksample|hkquantity|hkcategor|hkstatistic|hkactivit|health\s*(permission|data|store)|workout\s*(session|builder|recovery|mirror|build)', prompt_lower):
    matches.append("axiom-health")

# Real-world payments (Apple Pay / Wallet / Tap to Pay)
# NOT in-app purchase / IAP — that belongs to axiom-integration
if re.search(r'apple\s*pay|pkpayment|pkpaymentauthorization|passkit|\bpkpass\b|wallet\s*pass|tap\s*to\s*pay|orders?\s*in\s*wallet|merchant\s*(id|capabilit|identifier)|payment\s*(request|network|method)', prompt_lower):
    matches.append("axiom-payments")

# Design
if re.search(r'human interface|hig\b|liquid glass|sf symbol|symbol.{0,5}(effect|variablevalue|render)|typography.{0,10}(ios|swift|app)|design.{0,5}(system|pattern|token)|app.{0,5}(entry|launch|onboard)|authentication.{0,5}(flow|screen|ui)', prompt_lower):
    matches.append("axiom-design")

# UIKit
if re.search(r'uikit|uiview\b|uiviewcontroller|auto\s*layout|nslayoutconstraint|uiviewrepresentable|uihostingcontroller|combine\b.{0,10}(publisher|subscriber|sink|assign)|textkit|nstextlayoutmanager|uilabel|uitableview|uicollectionview', prompt_lower):
    matches.append("axiom-uikit")

# Swift language
if re.search(r'noncopyable|~copyable|consuming\s+func|borrowing\s+func|transferable\b|draggable|dropdestinat|deep\s*link.{0,5}debug|swift.{0,5}(idiom|modern|pattern|style|convention)', prompt_lower):
    matches.append("axiom-swift")

# Location
if re.search(r'core\s*location|cllocation|clmonitor|clgeocoder|mapkit|mkmap|mkannotation|mkdirection|geofenc|region\s*monitor|significant.{0,5}location|clauthorization|location.{0,5}(service|permiss|track|updat|manag|accura)', prompt_lower):
    matches.append("axiom-location")

# Security
if re.search(r'keychain|secitem|seckey|secaccess|passkey.{0,5}(implement|add|creat|auth)|code\s*sign|provisioning\s*profile|certificate.{0,10}(sign|identity|distribut)|encrypt.{0,10}(data|file|aes|chacha)|cryptokit|secureenclave|app\s*attest|dcappattest|devicecheck', prompt_lower):
    matches.append("axiom-security")

# Apple docs (iOS version uncertainty, API lookups)
if re.search(r'ios (19|2[0-9])|does.*ios.*exist|current.*ios|which ios|what.*ios.*version|wwdc.{0,5}(session|video|transcript|20\d\d)', prompt_lower):
    matches.append("axiom-apple-docs")

# Xcode MCP
if re.search(r'xcode\s*mcp|mcpbridge|xcrun\s*mcp|xcode.{0,5}(read|build|test|preview).{0,10}mcp', prompt_lower):
    matches.append("axiom-xcode-mcp")

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
