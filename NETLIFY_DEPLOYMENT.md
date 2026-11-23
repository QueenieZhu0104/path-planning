# Path V79 — Netlify deployment

The repository is ready for a Netlify deploy from its root directory. `netlify.toml` publishes `public/` and packages the six active API routes as Netlify Functions without changing their public `/api/*` URLs.

## Runtime configuration

Set secrets in **Netlify → Project configuration → Environment variables**. Do not commit them and do not put them in `netlify.toml`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | Required for DeepSeek | Server-side DeepSeek key. When present, all AI routes prefer DeepSeek and never send the key to the browser. |
| `DEEPSEEK_MODEL` | Optional | Defaults to `deepseek-flash`; overrides the DeepSeek model used by all AI routes. |
| `DEEPSEEK_CONSULTANT_MODEL` | Optional | Compatibility override used by path-intelligence, route evidence, and activity evidence. The chat module has been removed. |
| `DEEPSEEK_BASE_URL` | Optional | Defaults to `https://api.deepseek.com`; intended only for a compatible DeepSeek gateway. |
| `OPENAI_API_KEY` | Optional override | Netlify AI Gateway injects this automatically after the first production deploy on supported credit-based plans. Set your own value only to use your own OpenAI account. |
| `OPENAI_BASE_URL` | Automatic / optional | Netlify AI Gateway injects its routing URL. A custom value may be supplied with your own OpenAI-compatible gateway. |
| `OPENAI_MODEL` | Optional | Overrides the default model used by non-streaming AI routes. |
| `OPENAI_CONSULTANT_MODEL` | Optional | Compatibility override used by path-intelligence, route evidence, and activity evidence. |
| `COLLEGE_SCORECARD_API_KEY` | Optional | Enables live College Scorecard search when explicitly requested; the bundled 31-university catalogue works without it. |

Cloudflare bindings such as `AI` and `UNIVERSITY_DB` are not available on Netlify. On Netlify, the app prefers `DEEPSEEK_API_KEY`, then falls back to the automatically injected AI Gateway/OpenAI variables, and uses the bundled university catalogue. Keep all provider keys in Netlify environment variables, never in browser code or `netlify.toml`.

The activity-details function is limited to 12 requests per 60 seconds per IP/domain, and route-evidence to 6. These limits reduce abuse risk but do not create a hard project-wide spending cap; monitor AI usage and the team's Netlify credit balance.

After adding or changing environment variables, trigger a new deploy so Functions receive the updated values.

## Local verification

```powershell
pnpm test
pnpm run test:browser
netlify dev
```

The real browser suite uses mocked API responses. It does not prove that an OpenAI key, College Scorecard key, or deployed endpoint works.

## Deploy and smoke-test

Authenticate through Netlify's official browser flow; never paste an account password into a terminal or chat.

```powershell
netlify login
netlify deploy          # draft/preview deploy
netlify deploy --prod   # production only after the preview checks pass
```

Check the preview URL before production:

1. `/` loads Path V79.
2. `/api/universities?q=Stanford` returns a bundled catalogue result.
3. `/api/activity-details?id=<registered-id>` returns a source-grounded 48-hour record, or an explicit provider/source error; an unregistered ID returns 404 before network access.
4. Syllabus and University Info clearly report provider or source errors instead of inventing facts.
5. Onboarding, Explore, University, Major, Activity, Add to Path, Plan, Reminders, Reset, and Syllabus still work.
6. The scheduled function is registered, and logs show it refreshes only missing or expired activity/route records. The 48 registered sources may need up to about 24 hours for first population.


## Activity refresh boundary

The activity database covers exactly the 48 organiser URLs registered in `data/activity-sources.json`. Records use `activity/{activityId}` in Netlify Blobs and refresh only after their 48-hour TTL. The hourly job handles at most two missing/due activities per run. It is not an automatic global competition discovery crawler; sources outside the registry require a deliberate reviewed registry change. Do not present historical inline dates as live API output.
