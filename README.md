# path-planning
Path — University exploration and application planning platform

The repository now contains the expanded Path V78 source rather than only the
delivery ZIP. Start with [README_SETUP.md](README_SETUP.md) for local setup,
backend-provider boundaries, tests, and the deployment gate.

中文学生端与管理员操作说明见 [PATH_V78_使用说明.md](PATH_V78_使用说明.md)。

The continuation now also includes a normalized 31-record university catalogue,
an optional Cloudflare D1 seed/migration path, an opt-in U.S. College Scorecard
adapter, a source-grounded route-evidence cache, and a centralized cache for the
48 registered official activity sources. Each activity record is eligible for
refresh only after 48 hours; an hourly job checks only missing or expired records.
The first 48-record population may take up to about 24 hours. This registry does
not automatically discover competitions outside its allowlisted sources, and
stored V78 dates are never presented as live results. AI claims that cannot be
matched to fetched source text are discarded.

Deployment remains an explicit release action. The local `wrangler.toml`
deliberately omits the Pages project name and production output configuration;
`netlify.toml` defines the existing Netlify build/functions layout, but secrets,
site ownership, plan capacity, and the exact production target must still be
confirmed before a production deploy.
