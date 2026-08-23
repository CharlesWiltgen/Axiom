
# WeatherKit — Apple Weather Data

WeatherKit gives your app current conditions, minute/hourly/daily forecasts, severe-weather alerts, and historical averages from the Apple Weather service. The Swift API is a one-liner — `WeatherService.shared.weather(for:)` — but two things will sink you if you skip them: **mandatory attribution** (App Review rejects without it) and the **500,000-call/month quota** (every full fetch counts).

## Core mental model

You give WeatherKit a `CLLocation`; it returns a `Weather` value containing the datasets you asked for. Two cost-relevant truths:

- `weather(for:)` fetches **all** datasets — convenient but quota-heavy.
- `weather(for:including:)` fetches **only** the datasets you name, returning them as a tuple — use this to protect your quota.

WeatherKit is a paid service with a free tier. Attribution is a contractual + App Review requirement, not a nicety.

## When to Use This Skill

- Showing current conditions or forecasts (hourly, daily, minute precipitation)
- Surfacing severe-weather alerts or historical climate averages
- Deciding between the Swift API and the REST API (web/other platforms)
- Managing the 500K/month quota or planning paid tiers
- Getting attribution right before App Review

WeatherKit needs a `CLLocation` — for acquiring one, see axiom-location. For the REST API's JWT signing, see axiom-networking. Attribution is also an App Review gate — see axiom-shipping.

## System Requirements

| Capability | Minimum |
|------------|---------|
| WeatherKit Swift API | iOS 16+, iPadOS 16+, macOS 13+, tvOS 16+, watchOS 9+, visionOS 1+ |
| REST API | Any platform (JWT-authenticated) |

Setup before any call:
1. Enable the **WeatherKit** capability on your App ID (Certificates, Identifiers & Profiles) and add it to your target's entitlements.
2. For REST, create a **Service ID** and a private key (`.p8`); you sign a JWT from Team ID + Key ID + Service ID.

## Pricing and quota

- **500,000 calls/month** are included with Apple Developer Program membership.
- Paid monthly tiers (USD): 1M $49.99, 2M $99.99, 5M $249.99, 10M $499.99, 20M $999.99, 50M $2,499.99, 100M $4,999.99, 150M $7,499.99, 200M $9,999.99.
- Upgrading **resets your quota to 0** and starts a new billing period. Unused calls **don't roll over**.

A `weather(for:)` call that pulls every dataset costs more than a focused query — call cost is tied to the datasets returned. If you only need current + daily, request just those with `weather(for:including:)` and cache aggressively.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| No attribution shown | App Review **rejects**; it also violates the WeatherKit terms | Display the Apple Weather mark + link to `legalPageURL` |
| 401 / auth failures | WeatherKit capability not enabled, or REST JWT misconfigured | Enable the capability; verify Service ID / Key ID / Team ID for REST |
| Quota burns fast | `weather(for:)` fetches all datasets on every call | Use `weather(for:including:)` and cache results |
| Assuming a dataset exists everywhere | Minute precipitation and alerts are region-limited | Check `WeatherAvailability`; handle `.unsupported` |
| Querying without a location | WeatherKit needs a `CLLocation` | Acquire one via Core Location first |
| Caching forever | Forecasts go stale; each datum has a validity window | Honor `metadata.expirationDate`; refetch when expired |

## Querying weather

```swift
import WeatherKit
import CoreLocation

let location = CLLocation(latitude: 37.33, longitude: -122.03)

// Everything (one call, all datasets — convenient, quota-heavy)
let weather = try await WeatherService.shared.weather(for: location)
let temp = weather.currentWeather.temperature
let today = weather.dailyForecast.first

// Only what you need (quota-friendly) — `including:` returns a typed tuple
let (current, hourly) = try await WeatherService.shared.weather(
    for: location, including: .current, .hourly)
```

Datasets you can request via `WeatherQuery`: `.current`, `.minute`, `.hourly`, `.daily`, `.alerts`, `.availability`, plus `.historicalComparisons` and date-ranged variants (`daily(startDate:endDate:)`, `hourly(startDate:endDate:)`) for historical averages. The tuple's element types match the order you list them; requesting a single dataset returns that type directly, not a one-element tuple.

`weather.currentWeather` (temperature, condition, humidity, UV index, wind), `.minuteForecast` (next-hour precipitation, region-limited), `.hourlyForecast`, `.dailyForecast`, `.weatherAlerts` (region-limited). Each result carries `metadata` with an `expirationDate` and the `location`.

## Mandatory attribution

Apple requires the Apple Weather logo and a link to the data sources on any screen that shows WeatherKit data. Fetch it once and cache it.

```swift
let attribution = try await WeatherService.shared.attribution

// Logo (pick by color scheme), and a tap target to the legal page
let logoURL = colorScheme == .dark
    ? attribution.combinedMarkDarkURL
    : attribution.combinedMarkLightURL
// AsyncImage(url: logoURL) ; Link(destination: attribution.legalPageURL) { ... }
```

`WeatherAttribution` exposes `combinedMarkLightURL`, `combinedMarkDarkURL`, `squareMarkURL`, `legalPageURL`, `serviceName`, and `legalAttributionText` (a text fallback when you can't render the logo/links — e.g. voice or a watch complication). If you build a *value-added* product derived from the data, attribute the source to "Weather" with a notice that Apple's data was modified.

## REST API

For websites and non-Apple platforms, call the REST endpoint with a JWT signed by your `.p8` key (Service ID, Key ID, Team ID). Same datasets, same attribution requirement. See axiom-networking for JWT signing patterns.

## Regional availability

Not every dataset exists everywhere. Query `.availability` (`WeatherAvailability`) and treat `minuteForecast` / `weatherAlerts` as optional — they may be `.unsupported` for a given location. Never assume alerts exist before checking.

## Common Mistakes

- Shipping without attribution — the single most common WeatherKit App Review rejection.
- Calling `weather(for:)` on every view refresh — burns quota; cache and honor `expirationDate`.
- Forgetting to enable the WeatherKit capability (Swift) or misconfiguring the Service ID/keys (REST).
- Assuming minute precipitation or alerts are available globally.
- Hardcoding a quota assumption — verify your tier; upgrades reset the counter and don't roll over.
- Querying before you have a `CLLocation`.

## Resources

**WWDC**: 2022-10003

**Docs**: /weatherkit, /weatherkit/weatherservice, /weatherkit/weather, /weatherkit/weatherattribution, /weatherkit/weatherquery, /weatherkit/weatheravailability, /weatherkit/weatheralert

**Skills**: axiom-location (acquiring a CLLocation), axiom-networking (REST JWT signing), axiom-shipping (attribution as an App Review requirement)
