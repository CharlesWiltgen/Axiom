
# WeatherKit — Apple Weather Data

WeatherKit gives your app current conditions, minute/hourly/daily forecasts, severe-weather alerts, and historical averages from the Apple Weather service. The Swift API is a one-liner — `WeatherService.shared.weather(for:)` — but two things will sink you if you skip them: **mandatory attribution** (App Review rejects without it) and the **500,000-call/month quota** (counted in API calls).

## Core mental model

You give WeatherKit a `CLLocation`; it returns a `Weather` value containing the datasets you asked for. Two shapes to keep straight:

- `weather(for:)` fetches **all** datasets in one request.
- `weather(for:including:)` fetches **only** the datasets you name, returning them as a tuple and a smaller response.

Apple publishes no per-dataset counting rule for the quota, so treat both shapes as drawing on it; the difference between them is response size and decode cost.

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

Requests draw on the same 500,000-call monthly quota. Narrow the request for the smaller response, and cache aggressively: a refresh loop, not a broad query, is what burns the cap.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| No attribution shown | App Review **rejects**; it also violates the WeatherKit terms | Display the Apple Weather mark + link to `legalPageURL` |
| 401 / auth failures | WeatherKit capability not enabled, or REST JWT misconfigured | Enable the capability; verify Service ID / Key ID / Team ID for REST |
| Quota burns fast | Refetching on every view refresh draws on the 500,000-call monthly quota | Cache results and honor `expirationDate`; request only the datasets you show |
| Assuming a dataset exists everywhere | Minute precipitation and alerts are region-limited | Check `WeatherAvailability`; handle `.unsupported` |
| Querying without a location | WeatherKit needs a `CLLocation` | Acquire one via Core Location first |
| Caching forever | Forecasts go stale; each datum has a validity window | Honor `metadata.expirationDate`; refetch when expired |

## Querying weather

```swift
import WeatherKit
import CoreLocation

let location = CLLocation(latitude: 37.33, longitude: -122.03)

// Everything (one call, all datasets — the largest response)
let weather = try await WeatherService.shared.weather(for: location)
let temp = weather.currentWeather.temperature
let today = weather.dailyForecast.first

// Only what you need (smaller response) — `including:` returns a typed tuple
let (current, hourly) = try await WeatherService.shared.weather(
    for: location, including: .current, .hourly)
```

Datasets you can request via `WeatherQuery`: `.current`, `.minute`, `.hourly`, `.daily`, `.alerts`, `.availability`, plus `.historicalComparisons` (iOS 18+) and the date-ranged variants (`daily(startDate:endDate:)`, `hourly(startDate:endDate:)`) that return recorded data for an arbitrary range — history goes back to Aug 1, 2021, and one request returns at most 10 days. Climate averages are a different API: `WeatherService.dailyStatistics(for:including:)` and `monthlyStatistics(for:including:)` (iOS 18+) derive their values from weather recorded over past decades. The tuple's element types match the order you list them; requesting a single dataset returns that type directly, not a one-element tuple.

`weather.currentWeather` (temperature, condition, humidity, UV index, wind), `.minuteForecast` (next-hour precipitation, region-limited), `.hourlyForecast`, `.dailyForecast`, `.weatherAlerts` (region-limited). Each result carries `metadata` with an `expirationDate` and the `location`.

## Mandatory attribution

Apple requires the Apple Weather mark and a legal link to the data sources on any screen that shows weather data. Weather alerts are the exception, and get their own rules (below). Fetch the mark once and cache it.

```swift
let attribution = try await WeatherService.shared.attribution

// Logo (pick by color scheme), and a tap target to the legal page
let logoURL = colorScheme == .dark
    ? attribution.combinedMarkDarkURL
    : attribution.combinedMarkLightURL
// AsyncImage(url: logoURL) ; Link(destination: attribution.legalPageURL) { ... }
```

`WeatherAttribution` exposes `combinedMarkLightURL`, `combinedMarkDarkURL`, `squareMarkURL`, `legalPageURL`, `serviceName`, and `legalAttributionText` (a text fallback when you can't render the logo/links — e.g. voice or a watch complication). If you build a *value-added* product derived from the data, attribute the source to "Weather" with a notice that Apple's data was modified.

**Weather alerts are attributed differently.** Every alert you display must contain an embedded link to the Apple weather alert details page provided for that alert, its title or description must contain the full name of the issuing meteorological agency, and the alert text must not be modified, changed, altered, or obscured.

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
