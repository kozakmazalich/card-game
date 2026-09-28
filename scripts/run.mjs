// Runs a shell command with deploy secrets loaded from .env.deploy as env vars.
// Secrets never appear on the command line or in logs.
// Usage: node scripts/run.mjs <cmd> <args...>
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
try {
  const txt = readFileSync(join(root, '.env.deploy'), 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  console.error('No .env.deploy found — run from the project root.');
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/run.mjs <cmd> <args...>');
  process.exit(1);
}
const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: false });
process.exit(res.status ?? 1);
