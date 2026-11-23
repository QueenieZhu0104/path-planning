# Path V79 — Programme Syllabus + Official University and Activity Evidence APIs

## What the page does

Every one of the 390 programme entries in the current 31-university directory opens a plain-language Syllabus card. Each card has four tabs:

1. **Course map** — common concepts and methods a student may encounter.
2. **Practice and skills** — example assignments/projects (these are ideas, not official university assignments).
3. **Possible careers** — illustrative directions, not job guarantees.
4. **Who it may suit** — interests, challenges, and differences from adjacent subjects.

The offline guide uses 28 discipline-specific frameworks. The programme name and official university catalogue link are shown on each card. This is a student-friendly subject guide, not the university's official course list; it does not claim that every example is a required module at the named university.

## How the source-based AI version works

The **AI 整理该校版本 / AI-summarise this university's source** button posts the university name, programme label, language and official source URL to `POST /api/syllabus`.

The Pages Function then:

- allows only HTTPS source URLs on the official domains used by the Path university directory;
- fetches readable HTML, blocks redirects to unrelated domains, strips common page chrome, and limits source text sent to the model;
- prompts the model to create a plain-language synthesis rather than copy the official source wording;
- separates source-supported statements from general disciplinary background, and warns when the source is only a catalogue/index;
- returns structured content for the four page tabs.

The status label tells the user whether the official page text appears to mention the programme title or whether it is only a general university catalogue/index. A name match is only a diagnostic, not proof that every curriculum detail has been verified.

Generated guides are cached in browser storage for the current device. The Path reset clears this Syllabus cache along with the other `path_` data.

## AI provider setup (optional, required for live generation)

The single HTML file intentionally does **not** contain an API secret. In static/file preview, the AI button displays a clear fallback message and the built-in Syllabus remains available.

Choose one provider for the Pages Function:

### OpenAI API

1. Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder with your own API key. Keep `.dev.vars` private and out of Git.
2. The function reads `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default: `gpt-6-luna`). The model stays configurable so the deployment owner can change it without committing a secret or code change.
3. A real model request may incur charges. Do not paste the key into `public/index.html`.

### Cloudflare Workers AI

Bind Workers AI using the binding name `AI` in the Cloudflare Pages project settings. The function uses `@cf/meta/llama-3.1-8b-instruct` by default, configurable via `WORKERS_AI_MODEL`. Cloudflare documents local binding setup and notes that requests use the account's AI service and can incur usage charges: https://developers.cloudflare.com/pages/functions/bindings/.

## Local development

```bash
npm install
npm run dev
```

The project uses Cloudflare Pages Functions routing from `functions/api/syllabus.js`. For local Workers AI development, use a configured binding or `npx wrangler pages dev ./public --ai=AI` as supported by the Pages Functions runtime.

## Automated tests

```bash
npm test
npm run test:browser
```

`npm test` runs backend contract tests with mocked university pages and mocked AI provider responses. They check provider configuration, request/source byte limits, domain allowlisting, redirect rejection, OpenAI response handling, Cloudflare AI binding handling, malformed model output, evidence locators, cache policy, and HTTP method handling.

`npm run test:browser` launches a real Chromium-family browser. Install Playwright Chromium with `npx playwright install chromium`, or on Windows set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome/Edge executable. The browser suite covers Onboarding, Explore, University, Major, Activity, Add to Path, Plan, Reminders, Reset, all four Syllabus tabs, and the mocked 48-hour activity-details panel. Mocked API UI checks are **not** live AI/model or live university-site tests.

## Deployment notes

To run the AI function, deploy the **full project folder** with Cloudflare Pages Functions support. Cloudflare documents that Pages Functions can be deployed through Git integration or Wrangler and that dashboard Direct Upload is not supported for Functions: https://developers.cloudflare.com/pages/functions/get-started/.

The checked-in `wrangler.toml` is intentionally local-only: it has no production project name or `pages_build_output_dir`. First download and review the confirmed existing project configuration, then configure the chosen provider privately:

```bash
npx wrangler pages download config YOUR_CONFIRMED_PROJECT
npx wrangler pages secret put OPENAI_API_KEY --project-name YOUR_CONFIRMED_PROJECT
```

Review the downloaded configuration before replacing the local file. If using Workers AI instead of OpenAI, add/confirm the `AI` binding in the Pages project configuration or dashboard. Before exposing either endpoint publicly, configure Cloudflare rate limiting/abuse controls on `/api/syllabus` and `/api/university-info`; the source-domain allowlist does not prevent repeated paid requests.

After those gates are confirmed, the repository's guarded deployment command additionally requires both `CLOUDFLARE_PAGES_PROJECT` and an exact `PATH_DEPLOY_CONFIRM=deploy:<project>` value. This audit did not set those values and did not deploy.

## Test boundary

The current audit report is included as `TEST_REPORT.md`. No real provider credentials were supplied and no deployment was made, so the live OpenAI/Workers AI model response and live server-side reads from all 31 university websites have not been claimed as tested.

## Source-grounded university information API (V77 groundwork)

A second endpoint, `POST /api/university-info`, supports source-limited questions about a university. Supply `university`, an optional `question`, `lang` (`zh`, `tw`, or `en`), and 1–3 `sourceUrls` from the allowlisted official university domains. The endpoint reads those pages at request time, sends only extracted page text to the configured AI provider, and returns source-linked claims, `notVerified` items, next steps, and retrieval timestamps. The response field remains named `verifiedFacts` for V78 client compatibility, but the UI labels these as model-generated claims linked to fetched page text and tells the user to open the cited page. POST results use `Cache-Control: no-store` to avoid mixing different research questions through a shared cache.

Example request body:

```json
{
  "university": "The University of Hong Kong",
  "question": "Summarise current undergraduate admissions requirements for this programme",
  "lang": "en",
  "sourceUrls": ["https://admissions.hku.hk/"]
}
```

Important limitations: the client must supply the relevant official programme/admissions URLs; the endpoint does not discover every university page automatically. A successful fetch means the page was readable at retrieval time, not that the university itself updated it today. Review source URLs and expand the domain allowlist deliberately when adding universities. Live AI/API behaviour still requires deploying the full project and configuring an API secret or Cloudflare AI binding. Do not place secrets in `public/` or commit `.dev.vars`.

## V77 feature retained in V78 — Front-end official university information panel

The programme-detail Syllabus card now includes **查询大学官方最新信息 / Check official university information**. Clicking it sends the selected university, programme, language and the currently configured official URL to `POST /api/university-info`. The UI renders source-supported facts, unverified items, next checks, the retrieval timestamp, and clickable official source URLs. The source is fetched on demand; it does not run a hidden crawler or background polling loop.

### What “current” means

- The API fetches the supplied official URL when the user requests a check. The response is marked `no-store`; the application does not claim a background refresh or shared five-minute cache.
- Retrieval time means when Path fetched the page, not when the university last updated it.
- The programme page's configured URL may be a general admissions/catalogue page. Users should open the cited page and check programme-specific/current-cycle pages for critical details.
- The AI key or Cloudflare `AI` binding must be configured on the deployed Pages Functions environment. A static HTML preview cannot run the backend endpoint.

### Scheduled monitoring status

V77 is request-time retrieval, not scheduled monitoring. Reliable scheduled change detection needs a maintained source registry (specific official programme/admissions URLs), persistent snapshot/hash storage, retry/rate-limit rules, and an alert destination. Those should be configured deliberately rather than pretending that a cron job over generic university homepages guarantees current admissions data. A future scheduled monitor can use GitHub Actions + a versioned source registry and store change reports as workflow artifacts, or Cloudflare Cron Triggers + durable storage for a deployed service.


## V78 QA notes

V78 fixes the front-end official-information action so it uses the Syllabus source resolver exposed from the Syllabus module; V77 called a closure-local `chooseSource` from outside its scope, causing a `ReferenceError` when the official-information button was clicked. The visible product version is now V78. The Cloudflare Pages project name and production deployment settings must be confirmed against the user's existing account before deployment; do not deploy until the AI provider secret/binding and abuse controls are configured.

## Repository continuation audit (2026-10-19)

- Expanded the original V78 delivery ZIP into normal tracked source files while keeping the ZIP unchanged.
- Removed the stale `path-v76-syllabus` production target from active Wrangler configuration and added a non-active production example plus a guarded deployment command.
- Unified both API source-domain policies, enforce request and fetched-page limits on actual streamed bytes, require an evidence locator before returning a source-linked fact, and classify malformed model output consistently.
- Added `_routes.json` so the Pages Functions include rule is limited to `/api/*`.
- No deployment or production credential check was performed.

## University catalogue and 48-hour activity evidence

### `GET /api/universities`

The repository now has a backend university catalogue instead of relying only on the large inline front-end object. `data/universities.json` is generated from the actual V78 `DATA.universities` object and currently contains 31 university records and 390 stored programme labels. The labels are discovery metadata copied from V78; they are **not** a claim that every programme is currently offered or that any admissions rule has been verified.

Supported query parameters:

- `q`: university or stored programme-label search;
- `country`: exact country filter;
- `limit`: 1–50 records;
- `live=1`: explicitly request the optional U.S. College Scorecard adapter.

By default the endpoint reads the tracked JSON catalogue. If a Cloudflare D1 binding named `UNIVERSITY_DB` exists, it uses that database. `migrations/0001_university_catalogue.sql` creates the schema and `migrations/0002_seed_path_v78.sql` seeds the current V78 records. Regenerate both catalogue artifacts with `pnpm run build:catalogue` after intentionally changing the front-end university data.

The optional College Scorecard adapter requires the server-side `COLLEGE_SCORECARD_API_KEY`. It adds only returned institution identity/location/site/size metadata and is limited to the United States. It does not invent or infer admissions requirements, deadlines, scores, rankings, fees, or admission probability. Live mode is opt-in so normal searches do not spend external quota unexpectedly.

### `POST /api/path-intelligence`

The previously called but missing route is implemented. It restricts model-selected activity IDs to the IDs supplied by the client. It remains an internal route-level evidence organizer; there is no chat interface.

### `GET /api/activity-details?id=...`

The 48 entries in `data/activity-sources.json` are the server authority for activity identity and organiser URL. Each activity is stored independently in Netlify Blobs under `activity/{activityId}`. A successful source-grounded record has a 48-hour TTL. The hourly scheduled job refreshes only records that are missing or already due, at most two activities per run; an empty 48-record cache can therefore take up to about 24 hours to populate. A page request can also populate a missing record immediately.

Only `status`, `date`, `deadline`, `eligibility`, and `details` excerpts that occur verbatim in the fetched registered organiser page are returned. A failed refresh keeps the last successful payload as an explicitly marked stale fallback. This is a maintained registry, not an open web crawler: it does not discover or publish competitions outside the 48 registered sources. Historical dates embedded in the V78 package are not live API results.

### `POST /api/route-evidence`

The V79 evidence layer accepts only server-registered programme and activity IDs, reads the allow-listed official pages on the server, and asks the configured AI model to classify that fetched text. Every displayed claim must contain a short excerpt that is found verbatim in the fetched page; model text that cannot be matched is discarded. The response separates university admissions evidence from Path direction evidence and returns evidence coverage (`strong`, `partial`, or `insufficient-evidence`) rather than an admissions probability or ranking.

On Netlify, successful responses are stored in Netlify Blobs for 48 hours. Expired entries refresh on the next request, while `evidence-refresh` performs an hourly, bounded supplemental scan. This is not a promise that every possible route is fetched exactly once every 48 hours. The scheduled function registration and a real scheduled execution must be verified separately.

Netlify requires server-side `DEEPSEEK_API_KEY` (preferred) or `OPENAI_API_KEY`; `COLLEGE_SCORECARD_API_KEY` enables the U.S.-only federal dataset fields. Keep all keys out of `public/` and client JavaScript. DeepSeek Responses calls use non-thinking JSON mode for this bounded normalization task and retry one documented whitespace-only JSON response. `@netlify/blobs` must be a physical package in the deployed function bundle; the tracked `.npmrc` selects a hoisted pnpm layout for that reason.

### Production setup gate

1. Confirm the existing Cloudflare Pages account and project; do not create or overwrite a target by guesswork.
2. Choose DeepSeek (`DEEPSEEK_API_KEY`), OpenAI (`OPENAI_API_KEY`), or the Cloudflare `AI` binding. The existing `*_CONSULTANT_MODEL` compatibility variables are still used by route/activity evidence and path-intelligence even though the chat module has been removed.
3. If using D1, create/confirm the database, apply both migrations, bind it exactly as `UNIVERSITY_DB`, and check row counts before traffic is switched.
4. If live U.S. metadata is wanted, store `COLLEGE_SCORECARD_API_KEY` as a Pages secret. Do not put it in Wrangler variables or front-end code.
5. Add rate limits and abuse controls for `/api/activity-details`, `/api/route-evidence`, `/api/path-intelligence`, `/api/universities`, `/api/syllabus`, and `/api/university-info`.
6. Run the contract and real-browser suites, then perform a separately labelled live-provider smoke test with the confirmed deployment credentials. Mocked tests are not a live service test.

Repository tests mock external providers. Record any separately executed live smoke test, deployment target, and scheduler observation in the release verification log; do not infer a live result from the automated suite.
