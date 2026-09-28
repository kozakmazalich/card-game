// Deploys to Vercel: link project → set SIGNER_PRIVATE_KEY (server-only) → deploy.
// Run via: node scripts/run.mjs node scripts/vercel-deploy.mjs
// Secrets are read from .env.deploy and piped over stdin — never logged.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function envFile() {
  const env = {};
  for (const line of readFileSync(join(root, '.env.deploy'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function run(args, { input } = {}) {
  const res = spawnSync('npx', ['-y', 'vercel@latest', ...args], {
    cwd: root,
    stdio: input !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input: input ?? undefined,
    env: { ...process.env, ...envFile() },
  });
  if (res.status !== 0) throw new Error(`command failed: vercel ${args.join(' ')}`);
}

const scope = 'mazals-projects-1ceb3d60';

// 1. Link (create if missing). Fall back to a suffixed name on conflict.
let project = 'robot-hunt';
try {
  run(['link', '--yes', '--scope', scope, '--project', project]);
} catch {
  project = 'robot-hunt-game';
  run(['link', '--yes', '--scope', scope, '--project', project]);
}

// 2. Server-only signer key. Piped over stdin, not shown in any log.
const key = envFile().SIGNER_PRIVATE_KEY;
if (!key) throw new Error('SIGNER_PRIVATE_KEY missing from .env.deploy');
for (const target of ['production', 'preview', 'development']) {
  run(['env', 'add', 'SIGNER_PRIVATE_KEY', target], { input: key + '\n' });
}

// 3. Production deploy.
run(['deploy', '--prod', '--yes']);

console.log(`\nDEPLOY DONE · project: ${project} (${scope})`);
