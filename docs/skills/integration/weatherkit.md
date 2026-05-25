---
name: weatherkit
description: Apple Weather data — forecasts, alerts, the 500K/month quota, and mandatory attribution
skill_type: skill
version: 1.0
apple_platforms: iOS 16+, iPadOS 16+, macOS 13+, tvOS 16+, watchOS 9+, visionOS 1+
---

# WeatherKit

WeatherKit gives your app current conditions, minute/hourly/daily forecasts, severe-weather alerts, and historical averages from the Apple Weather service. The Swift API is a one-liner, but two things sink apps that skip them: **mandatory attribution** (App Review rejects without it) and the **500,000-call/month quota**.

Part of the **axiom-integration** suite (`skills/weatherkit.md`).

## When to Use

Use this skill when you're:
- Showing current conditions or forecasts (hourly, daily, minute precipitation)
- Surfacing severe-weather alerts or historical climate averages
- Deciding between the Swift API and the REST API (web / other platforms)
- Managing the 500K/month quota or planning paid tiers
- Getting attribution right before App Review

## Example Prompts

- "How do I show the weather forecast with WeatherKit?"
- "Why was my weather app rejected by App Review?"
- "How much does WeatherKit cost / what's the quota?"
- "How do I fetch only the daily forecast to save quota?"
- "How do I set up the WeatherKit REST API?"

## Key Concepts

### Two query shapes, very different cost

`weather(for:)` fetches all datasets; `weather(for:including:)` fetches only the ones you name (returning a typed tuple). Use the focused form and cache results — every full fetch counts against your quota.

### Attribution is mandatory

Any screen showing WeatherKit data must show the Apple Weather mark and link to `legalPageURL`. Fetch `WeatherService.shared.attribution` once and cache it; use `legalAttributionText` as the fallback where you can't render a logo. Skipping this is the most common WeatherKit rejection.

### Pricing and quota

500,000 calls/month are included with Apple Developer Program membership. Paid tiers run from 1M ($49.99) to 200M ($9,999.99) per month. Upgrades reset the counter to 0; unused calls don't roll over.

### Setup

Enable the WeatherKit capability on your App ID (Swift), or create a Service ID + `.p8` key and sign a JWT (REST). WeatherKit needs a `CLLocation` — acquire one via Core Location first.

### Regional availability

Minute precipitation and alerts are region-limited. Query `.availability` and treat those datasets as optional.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| No attribution | App Review rejection | Show the mark + link to `legalPageURL` |
| `weather(for:)` every refresh | Quota burn | Use `including:`, cache, honor `expirationDate` |
| Capability/Service not configured | 401 auth errors | Enable WeatherKit; verify REST keys |
| Assuming alerts exist everywhere | Crashes / empty UI | Check `WeatherAvailability` |
| Querying with no location | No data | Acquire a `CLLocation` first |

## Related

- For acquiring a `CLLocation`, see the axiom-location suite
- For REST JWT signing, see the axiom-networking suite
- Attribution is also an App Review gate — see the axiom-shipping suite

## Resources

**WWDC**: 2022-10003

**Docs**: /weatherkit, /weatherkit/weatherservice, /weatherkit/weather, /weatherkit/weatherattribution, /weatherkit/weatherquery, /weatherkit/weatheravailability
