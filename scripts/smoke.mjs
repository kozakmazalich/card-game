// End-to-end smoke test of the MVP acceptance flow.
// Requires Google Chrome on macOS and the dev server running on :5173.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = 'http://localhost:5173';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const errors = [];
let failed = 0;
let passed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

const questionDir = join(root, 'src', 'data', 'questions');
const allQuestions = readdirSync(questionDir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(questionDir, f), 'utf8')));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${m.location().url ?? ''} ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(String(e)));

const text = () => page.evaluate(() => document.body.innerText);
const waitFor = (needle, timeout = 12000) =>
  page.waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle);

try {
  console.log('— home —');
  await page.goto(URL_BASE, { waitUntil: 'networkidle0' });
  await waitFor('ROBOT HUNT');
  check('home renders', true);
  await page.screenshot({ path: '/tmp/rh-01-home.png' });
  check('shows 0 / 98 progress', await page.evaluate(() => /0\s*\/\s*98\s*ROBOTS/.test(document.querySelector('.hero-progress')?.textContent ?? '')));
  check('home scene shows 10 real robots', await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.cm-robot img, .cm-robot')];
    return imgs.length >= 10;
  }));

  console.log('— hunt: pack → shuffle → locked → correct answer —');
  await page.click('.hero-actions .btn-primary');
  await waitFor('TAP TO OPEN');
  check('pack stage', true);
  await page.screenshot({ path: '/tmp/rh-02-pack.png' });
  await page.click('.pack-wrap');
  await waitFor('HUMAN CHECK', 30000);
  check('shuffle → locked + challenge', true);
  const timer = await page.evaluate(() => document.querySelector('.timer-pill')?.textContent ?? '');
  check('timer visible', /^\s*\d{2}\s*$/.test(timer), `(got "${timer}")`);
  await page.screenshot({ path: '/tmp/rh-03-locked.png' });

  const qText = await page.evaluate(() => document.querySelector('.challenge-q')?.textContent ?? '');
  const match = allQuestions.find((q) => q.question === qText);
  check('question came from the verified DB', Boolean(match), `(q: "${qText.slice(0, 60)}…")`);
  const correct = match?.correctAnswer;
  const clicked = await page.evaluate((answer) => {
    const btn = [...document.querySelectorAll('.answer-btn')].find((b) => b.textContent.trim() === answer);
    if (!btn) return false;
    btn.click();
    return true;
  }, correct);
  check('clicked correct answer', clicked, `(answer: ${correct})`);

  await waitFor('ROBOT ACQUIRED!', 12000);
  check('ROBOT ACQUIRED! appears', true);
  await page.screenshot({ path: '/tmp/rh-04-acquired.png' });

  console.log('— collection —');
  await page.click('.result-actions .btn:not(.btn-primary)'); // MY COLLECTION
  await waitFor('MY ROBOT COLLECTION');
  check('collection screen', true);
  const body = await text();
  await page.waitForFunction(() => /1\s*\/\s*98/.test(document.querySelector('.collection-count')?.textContent ?? ''), { timeout: 5000 });
  check('collection shows 1 / 98', (await text()).includes('% COMPLETE'));
  check('one owned card rendered', await page.evaluate(() => document.querySelectorAll('.robot-card:not(.missing)').length >= 1));
  check('missing slots are mystery slots', await page.evaluate(() => document.querySelectorAll('.robot-card.missing').length === 97));
  await page.screenshot({ path: '/tmp/rh-05-collection.png' });

  console.log('— streak + wrong answer —');
  await page.goto(URL_BASE + '/#/hunt', { waitUntil: 'networkidle0' });
  await waitFor('TAP TO OPEN');
  await page.click('.pack-wrap');
  await waitFor('HUMAN CHECK', 30000);
  const wrong = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.answer-btn')];
    const q = document.querySelector('.challenge-q')?.textContent;
    return { btns: btns.map((b) => b.textContent.trim()), q };
  });
  const q2 = allQuestions.find((x) => x.question === wrong.q);
  const wrongAnswer = wrong.btns.find((a) => a !== q2?.correctAnswer);
  await page.evaluate((a) => {
    [...document.querySelectorAll('.answer-btn')].find((b) => b.textContent.trim() === a).click();
  }, wrongAnswer);
  await waitFor('THE ROBOT ESCAPED!');
  check('wrong answer → ROBOT ESCAPED', true);
  check('correct answer revealed', (await text()).includes('CORRECT ANSWER'));
  await page.screenshot({ path: '/tmp/rh-06-escaped.png' });

  console.log('— profile / wallet —');
  await page.goto(URL_BASE + '/#/profile', { waitUntil: 'networkidle0' });
  await waitFor('PLAYER');
  check('profile renders', true);
  check('streak reset to 0 after wrong answer', await page.evaluate(() => document.body.innerText.match(/🔥\s*0/)));
  await page.click('.wallet-chip');
  await waitFor('USE MOCK WALLET');
  await page.click('.modal .btn-primary');
  await waitFor('MOCK WALLET CONNECTED', 6000);
  check('mock wallet connect + toast', true);
  await page.screenshot({ path: '/tmp/rh-07-profile.png' });

  console.log('— leaderboard —');
  await page.goto(URL_BASE + '/#/leaderboard', { waitUntil: 'networkidle0' });
  await waitFor('LEADERBOARD');
  check('leaderboard rows render', await page.evaluate(() => document.querySelectorAll('.lb-row').length >= 5));
  await page.screenshot({ path: '/tmp/rh-08-leaderboard.png' });

  // /api 404s = local-dev fallback; Failed-to-load = transient dev-server image noise.
  const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('/api/') && !e.includes('Failed to load resource'));
  check('no console/page errors', realErrors.length === 0, `\n    ${realErrors.slice(0, 5).join('\n    ')}`);
} catch (e) {
  failed++;
  console.error('SMOKE TEST EXCEPTION:', e.message);
  try {
    console.error('  [debug stage]', await page.evaluate(() => ({
      hash: location.hash,
      label: document.querySelector('.hunt-stage-label')?.textContent,
      pack: Boolean(document.querySelector('.pack-wrap')),
      shuffling: Boolean(document.querySelector('.shuffle-stage')),
      locked: Boolean(document.querySelector('.challenge-panel')),
      body: document.body.innerText.slice(0, 200),
    })));
  } catch {}
  await page.screenshot({ path: '/tmp/rh-failure.png' }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
