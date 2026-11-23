# Path V79 deployment checklist

Do not deploy until every required item is confirmed against the existing Cloudflare account.

- [ ] Existing Pages project name, account, branch, custom domains, and current production config confirmed.
- [ ] Git diff and rollback artifact reviewed; original V78 ZIP retained.
- [ ] Full project deployed through a Pages Functions-capable workflow, not static ZIP inference.
- [ ] One AI provider selected: `OPENAI_API_KEY` secret or Cloudflare `AI` binding.
- [ ] Evidence/path-intelligence compatibility model override reviewed, or documented defaults accepted.
- [ ] Optional D1 database created/confirmed, both migrations applied, 31 seed rows checked, and binding named `UNIVERSITY_DB`.
- [ ] Optional `COLLEGE_SCORECARD_API_KEY` stored as a server-side secret; live search tested separately and labelled live.
- [ ] Rate limits, request budgets, logging/redaction, and abuse controls configured for every `/api/*` route.
- [ ] Privacy copy reviewed for profile, saved-route, source requests, provider-retention, and log handling.
- [ ] `pnpm test` and `pnpm run test:browser` pass on the release commit.
- [ ] Production smoke checks distinguish real provider calls from mocks and verify error/fallback states.
- [ ] Official university links sampled manually; no unverified deadline, score, requirement, ranking, fee, or probability is presented as fact.
- [ ] `/api/activity-details` accepts only registered IDs; the 48-hour TTL, stale fallback, hourly due-only scan, and first-population progress are checked in production logs.
- [ ] Release notes state that the 48-source registry does not auto-discover competitions and that package dates are not live API results.
- [ ] `PATH_DEPLOY_CONFIRM=deploy:<confirmed-project>` set only for the explicitly approved target.

This checklist prepares deployment; it does not authorize it.
