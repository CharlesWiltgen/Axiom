# App Review Guidelines Index

Verified against Apple's published guidelines (February 6, 2026 revision).

## Section 1: Safety

| Guideline | Topic |
|-----------|-------|
| 1.1 | Objectionable Content |
| 1.1.1 | Defamatory, discriminatory, or mean-spirited content |
| 1.1.2 | Realistic portrayals of people or animals being killed/maimed/tortured/abused |
| 1.1.3 | Depictions encouraging weapons use against people/animals |
| 1.1.4 | Pornographic material (immediate removal) |
| 1.1.5 | Religious/cultural/ethnic commentary that fosters prejudice |
| 1.1.6 | False information, fake functionality ("for entertainment" does NOT excuse this) |
| 1.1.7 | Capitalizing on recent events (tragedies, conflicts, epidemics) |
| 1.2 | User-Generated Content — must have filtering, reporting, blocking, contact info, age verification |
| 1.3 | Kids Category — no third-party analytics/advertising, COPPA/GDPR-Kids compliance |
| 1.4 | Physical Harm |
| 1.4.1 | Medical apps: disclose limitations, link to real medical help |
| 1.4.2 | Drug dosage calculators: recognized institutions only |
| 1.4.3 | Tobacco, e-cigarettes, vape, illegal drug use encouragement |
| 1.4.4 | DUI/checkpoint apps that encourage reckless behavior |
| 1.4.5 | Activities that risk physical harm (bets, dares, body modification) |
| 1.5 | Developer Information — program membership must be current |
| 1.6 | Data Security — ATS required, justified exceptions only |

## Section 2: Performance

| Guideline | Topic |
|-----------|-------|
| 2.1 | App Completeness — no crashes, broken links, placeholders, missing demo accounts |
| 2.2 | Beta/Demo/Trial — use TestFlight, not "beta" in app name or bundle ID |
| 2.3 | Accurate Metadata |
| 2.3.1 | No hidden/undocumented features; no misleading descriptions |
| 2.3.2 | No concealed features |
| 2.3.3 | Screenshots must reflect actual app experience on correct device |
| 2.3.5 | Use accurate App Store category |
| 2.3.6 | Age rating must match actual content |
| 2.3.7 | App name max 30 chars; no keyword stuffing in name/subtitle |
| 2.3.8 | Metadata must be age-appropriate; "For Kids"/"For Children" reserved for Kids category |
| 2.4 | Hardware Compatibility — must work with current OS |
| 2.5 | Software Requirements |
| 2.5.1 | Only public APIs |
| 2.5.2 | Self-contained; no code downloads that change functionality |
| 2.5.3 | No viruses, malware, code injection (immediate removal) |
| 2.5.4 | Multitasking must use proper background modes |
| 2.5.5 | Must be fully functional on IPv6-only networks |
| 2.5.6 | Web browsing must use WebKit (alternative engine entitlement available) |
| 2.5.9 | Request only necessary permissions |
| 2.5.11 | SiriKit/HealthKit must actually use the declared feature |
| 2.5.17 | Matter integration must use Apple's framework; third-party components CSA-certified |
| 2.5.18 | No display advertising in extensions, App Clips, widgets, notifications, keyboards, watchOS |

## Section 3: Business

| Guideline | Topic |
|-----------|-------|
| 3.1.1 | In-App Purchase required for digital goods/services. Loot box odds must be disclosed before purchase. NFTs: may sell via IAP, ownership must not unlock features. |
| 3.1.2 | Subscriptions: ongoing value, 7-day minimum period, cross-device, transparent terms (price, duration, auto-renewal, cancellation). Schedule 2 of DPLA requires ToS/PP on purchase screen. |
| 3.1.3(a-e) | External payments: reader apps, multiplatform, enterprise, person-to-person, physical goods |
| 3.1.4 | No artificial barriers between IAP and web purchase options |
| 3.1.5 | Cryptocurrency: wallets require organization enrollment, exchanges need licensing, no on-device mining, no crypto rewards for tasks |
| 3.2.2(viii) | Binary options trading apps prohibited |
| 3.2.2(ix) | Loan apps: max 36% APR including fees, no full repayment required within 60 days |

## Section 4: Design

| Guideline | Topic |
|-----------|-------|
| 4.0 | General design standards (HIG compliance) |
| 4.1 | Copycats — apps confusingly similar to existing apps (4.1(b): impersonation = removal from Developer Program) |
| 4.2 | Minimum Functionality — no web wrappers, no single-media apps, must have lasting value |
| 4.2.6 | Template/app-generation-service apps rejected unless submitted by content provider |
| 4.3 | Spam — no duplicate apps from same developer |
| 4.4.1 | Keyboard extensions must include next-keyboard switching |
| 4.5.4 | Push notifications: no advertising, marketing, or spam |
| 4.7 | Mini apps, streaming games, chatbots, emulators: must provide universal link index, age restrictions, content filtering |
| 4.8 | Sign in with Apple required when ANY third-party/social login offered (exceptions: company-internal, education, government, client apps for specific services) |
| 4.10 | Cannot monetize built-in capabilities (push, camera, gyroscope, Apple Music, iCloud storage, Screen Time APIs) |

## Section 5: Legal

| Guideline | Topic |
|-----------|-------|
| 5.1.1(i) | Privacy policy required in App Store Connect AND within app |
| 5.1.1(ii) | Permission requests must explain purpose with benefit to user |
| 5.1.1(iii) | Don't require unnecessary personal info |
| 5.1.1(v) | Account deletion must be offered if account creation supported |
| 5.1.1(vi) | Surreptitiously discovering passwords (removal from Developer Program) |
| 5.1.2(i) | No sharing with third parties without consent; ATT required for tracking |
| 5.1.3 | Health data must not be stored in iCloud; no false HealthKit data |
| 5.1.4 | Kids Category requirements (COPPA) |
| 5.1.5 | Location Services must have clear purpose |
| 5.2 | Intellectual Property — no unauthorized copyrighted material |
| 5.3 | Gaming/Gambling — real-money gambling requires licensing |
| 5.4 | VPN Apps — must use NEVPNManager API |
| 5.5 | Developer Code of Conduct |
| 5.6 | Telecommunications |

## Zero-Tolerance Guidelines (Immediate Removal Risk)

| Guideline | Consequence |
|-----------|-------------|
| 1.1.4 | Pornographic content → immediate removal |
| 2.5.3 | Viruses/malware → immediate removal |
| 4.1(b) | App impersonation → removal from Developer Program |
| 5.1.1(vi) | Surreptitious password discovery → removal from Developer Program |

## Top 10 Rejection Causes

| Rank | Guideline | Issue | % of Rejections |
|------|-----------|-------|-----------------|
| 1 | 2.1 | App Completeness (crashes, placeholders, broken flows) | ~40% |
| 2 | 5.1.1(i) | Privacy policy missing/inadequate | — |
| 3 | 2.1 | Incomplete review info (missing demo accounts) | — |
| 4 | 2.3.3 | Screenshots don't match app | — |
| 5 | 4.0 | Substandard UI / HIG violations | — |
| 6 | 4.2 | Web wrapper / insufficient functionality | — |
| 7 | 2.3.1 | Misleading metadata | — |
| 8 | 4.2 | Insufficient lasting value | — |
| 9 | 4.1 | Copycat app | — |
| 10 | 4.3 | Repeated similar apps | — |

## Sensitive App Types Requiring Extra Documentation

| Type | Requirements |
|------|-------------|
| Kids apps with third-party ads | Links to ad policies, proof of human review |
| Medical hardware integration | Regulatory clearance for all regions |
| Third-party content/trademarks | Authorization documentation |
| Gambling, VPN, real money gaming | Licensing documentation |
| Banking, crypto, healthcare, air travel | Must be submitted by legal entity (not individuals) |
