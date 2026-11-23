# Path V79 — Continuation QA Report (updated 2026-11-19)

This report separates tests actually executed in this continuation from historical V78 metadata. It does not treat mocked provider calls, stored review dates, or a ZIP upload as proof of a live deployment.

## Repository inspection

- Remote `main` contained only `README.md` and `Path_V78_READY_FOR_DEPLOY.zip` in commit `e18514a`; the project source was not tracked as normal files.
- The delivery ZIP passed an archive integrity check and contained 17 entries. Its SHA-256 is `30C098AA87CEFF58968B8FF9831EA464199C857986127FDC3CC9ACD2C86118DC`.
- The ZIP was extracted to a separate inspection directory. Source files were copied into the repository without deleting the ZIP, then committed as `ef50a57` (`Import Path V78 source from delivery archive`).
- No Cloudflare deployment was performed and no deployment was inferred from the archive name.

## Current release rerun status

| Check | Result | Scope / limitation |
|---|---:|---|
| Current `pnpm test` | PASS | Executed 2026-11-19: 10 inline-script syntax checks plus removed-feature, Syllabus, university-info, catalogue, activity-details, route-evidence, scheduled-refresh, path-intelligence, provider-resolver, and Netlify-adapter suites. All external source, AI, and College Scorecard calls were mocked. |
| Current `pnpm run test:browser` | PASS | Executed 2026-11-19 in installed Microsoft Edge through Playwright; completed the full local UI flow without page or console errors. All API responses were mocked. |
| `git diff --check` | PASS | No whitespace errors; Git printed only the repository's LF/CRLF conversion notices. |
| Local Cloudflare Pages Functions runtime | PASS (previous continuation) | Wrangler compiled the functions; `/` and bundled/D1 university searches returned 200. This was not rerun for the new activity endpoint. |
| Local D1 migrations | PASS (previous continuation) | Schema and 31 seed statements executed in isolated local D1; SQL count returned 31 universities / 390 programme labels. |
| Official-source reachability audit | PARTIAL (previous continuation) | Reachability only; not a content or admissions audit. |
| Production deployment | PASS | Netlify production deploy `6aff1a470533f82f52544196` completed; 3 static files and 7 Functions were deployed to `https://path-planning-v78.netlify.app/`. |
| Live activity request | BLOCKED | Production requests were real: several organiser pages returned explicit source errors; Stanford AI4ALL reached the AI stage, where DeepSeek returned `401`. A valid `DEEPSEEK_API_KEY` is still required before the 48-hour database can populate. |
| Live College Scorecard request | NOT RUN | The HTTP response contract was mocked. |

## Current browser acceptance scope (executed 2026-11-19)

The runner started a local HTTP server and launched installed Microsoft Edge through Playwright. The current release confirmed these checks:

1. Catalogue integrity: 31 universities, 390 University × programme routes, and allowed official-source hosts.
2. Onboarding language, name, interest, and region steps.
3. Explore search and university navigation.
4. University detail and programme selection.
5. Major detail and all four Syllabus tabs.
6. Syllabus UI with a mocked successful `/api/syllabus` response.
7. Official-information UI with a mocked `/api/university-info` response.
8. Activity view.
9. Add two routes to Path.
10. Plan view.
11. Reminder creation.
12. Centralized 48-hour activity-details panel using a mocked registered-source response.
13. Negative checks that the removed chat and route-comparison modules have no navigation, page, or live panel.
14. Reset and local-storage clearing.
15. Horizontal-overflow checks at 320, 390, 768, 1024, and 1440 CSS pixels, with no captured console or page errors.

This passing run proves only the local UI paths above; it does not prove live provider behavior or production-origin persistence.

## API fixes and contract coverage

### `/api/syllabus`

- Enforces actual streamed request-body and fetched-source byte limits instead of trusting only `Content-Length`.
- Reuses one HTTPS official-university allowlist and validates redirects.
- Retains `no-store` response caching and consistent error JSON.
- Uses `gpt-6-luna` as the configurable OpenAI default rather than the deprecated stored default.
- Contract checks cover provider missing, disallowed URL, structured OpenAI response, redirect rejection, Workers AI, malformed provider output, unsupported method, oversized request body, and oversized source body.

### `/api/university-info`

- Enforces actual request/source byte limits and shared redirect/host validation.
- Changes successful POST responses from a five-minute public cache to `Cache-Control: no-store`.
- Rejects malformed provider JSON and source claims without a non-empty evidence locator.
- Labels results as source-limited model summaries rather than independent verification.
- Contract checks cover provider missing, disallowed URL, structured source summary, redirect rejection, unsupported method, `no-store`, missing evidence, malformed provider output, and size limits.

### `/api/universities`

- Searches the tracked 31-university/390-programme-label catalogue, or a configured D1 binding.
- Makes College Scorecard access explicit through `live=1`; missing keys and provider failures are returned as metadata warnings rather than fabricated data.
- Contract checks cover bundled search, D1 selection, missing live-provider configuration, mocked College Scorecard normalization/key non-exposure, and HTTP methods.

### `/api/activity-details`

- Accepts only one ID from the 48-entry server activity registry and rejects unknown IDs before any network or AI access.
- Stores successful records as `activity/{activityId}` with a 48-hour TTL; fresh reads make no source/model call.
- Returns only exact source excerpts for status, date, deadline, eligibility, or details; unmatched model text is discarded.
- Keeps the last successful result as an explicitly marked stale fallback if a due refresh fails.
- The hourly job processes only missing or expired records, at most two activities per run. First population can take up to about 24 hours.
- It does not discover competitions outside the registered 48 sources; stored V78 dates are not live output.

### `/api/path-intelligence`

- Caps actual request bytes and bounds route/activity context.
- Filters model-selected activity IDs against the supplied registered candidates.

All automated API checks mock external calls. They are not live DeepSeek/OpenAI, Workers AI, competition-site, College Scorecard, or university-site tests.

## Official sources and data truthfulness

- All 31 configured university URLs are HTTPS and match the API allowlist.
- Server-side reachability on 2026-10-19: 20/31 returned reachable HTML; 11/31 returned network failures or HTTP challenges. None redirected outside the allowlist.
- Browser fallback for those 11: HKU, CUHK, and Toronto opened; Oxford, UCL, Melbourne, Michigan, and Princeton returned challenge/403 pages; MIT, HKUST, and Illinois remained connection failures.
- This only checked whether a configured page could be reached. It did not validate every programme title, admissions rule, deadline, score, or personal eligibility condition.
- Existing V78 activity and university review dates remain historical package metadata. UI labels now say they are stored V78 records and were not reverified in this run.
- Critical admissions information must be checked on the linked official page; the application does not claim that a model-produced summary is an authoritative university decision.

## Dependency and key handling

- `.dev.vars.example` is tracked while real `.dev.vars*` files remain ignored.
- No API key is embedded in `public/index.html`, the functions, or committed configuration.
- `wrangler.toml` is local-development-only. `wrangler.production.example.toml` contains placeholders and is not a production target.
- The deploy script refuses to run unless both `CLOUDFLARE_PAGES_PROJECT` and the matching explicit confirmation token are present.
- Rate limiting / abuse controls still need to be configured at the confirmed Cloudflare project before deployment.
- The example now includes placeholder-only evidence/path-intelligence compatibility model and College Scorecard settings; no real key was found in tracked files.

## Explicitly not executed or not passed

- Successful live DeepSeek normalization: the configured production DeepSeek credential returned HTTP 401 and was not exposed in any response.
- Live organizer-page retrieval across all 48 registered activity sources and observed completion of the first scheduled population. Sample production calls returned explicit `official_page_unavailable`, `source_has_insufficient_text`, and DeepSeek 401 errors; none were mislabeled as verified data.
- Live College Scorecard authentication, quota, latency, and production response behavior.
- Cloudflare Pages production deployment was not run. Netlify production deployment and smoke checks were run instead.
- Exhaustive current-cycle verification of admissions requirements, dates, scores, programme availability, or activities.
- Server-side source retrieval for 11 blocked/failed URLs; browser fallback did not turn those into API fetch passes.
- External application/submission flows.

## Deployment follow-up

Netlify production is live and the removed routes were verified. Before calling the 48-hour activity database operational, replace the rejected production `DEEPSEEK_API_KEY` with a valid key (including the `sk-` prefix), trigger a new deploy, and rerun one registered `/api/activity-details?id=...` request until it returns a source-grounded record or a source-only error rather than provider 401. Do not paste the key into source files, Git, or chat.
