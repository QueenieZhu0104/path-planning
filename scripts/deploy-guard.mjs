import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = String(process.env.CLOUDFLARE_PAGES_PROJECT || '').trim();
const confirmation = process.env.PATH_DEPLOY_CONFIRM;

if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) {
  console.error('Deployment blocked: set CLOUDFLARE_PAGES_PROJECT to the confirmed existing Pages project name.');
  process.exit(2);
}
if (confirmation !== `deploy:${project}`) {
  console.error(`Deployment blocked: set PATH_DEPLOY_CONFIRM=deploy:${project} only after the target, provider binding/secret, and abuse controls are confirmed.`);
  process.exit(2);
}

const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
if (!existsSync(wrangler)) {
  console.error('Deployment blocked: install dependencies before deploying.');
  process.exit(2);
}

console.log(`Deploying public/ and Pages Functions to confirmed project: ${project}`);
const result = spawnSync(process.execPath, [wrangler, 'pages', 'deploy', './public', '--project-name', project], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit'
});
process.exit(result.status ?? 1);
