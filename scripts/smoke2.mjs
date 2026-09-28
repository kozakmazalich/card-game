// Smoke test 2: duplicate → BURN (+scrap), duplicate → KEEP, and challenge timeout.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = 'http://localhost:5173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const qDir = join(root, 'src', 'data', 'questions');
const allQuestions = readdirSync(qDir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(qDir, f), 'utf8')));

const generated = readFileSync(join(root, 'src', 'data', 'cards.generated.ts'), 'utf8');
const cardIds = [...generated.matchAll(/"id": "(\d{3})"/g)].map((m) => m[1]);
if (cardIds.length !== 98) throw new Error(`expected 98 card ids, got ${cardIds.length}`);
const seedState = {
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  walletMode: 'mock',
  cardsClaimed: cardIds.length,
  owned: Object.fromEntries(cardIds.map((id) => [id, 1])),
  scrap: 0,
  streak: 3,
  bestStreak: 4,
  correct: 10,
  wrong: 2,
  timedOut: 0,
  achievements: {},
  muted: false,
  firstRun: false,
};

const errors = [];
let failed = 0;
let passed = 0;
const check = (n, c, e = '') => {
  if (c) {
    passed++;
    console.log(`  ✓ ${n}`);
  } else {
    failed++;
    console.log(`  ✗ ${n} ${e}`);
  }
};
const waitFor = (page, needle, timeout = 15000) =>
  page.waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${m.location().url ?? ''} ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(String(e)));

async function runHunt(answerCorrect) {
  await page.goto(URL_BASE + '/#/hunt', { waitUntil: 'networkidle0' });
  await waitFor(page, 'TAP TO OPEN');
  await page.click('.pack-wrap');
  await waitFor(page, 'HUMAN CHECK', 20000);
  const q = await page.evaluate(() => document.querySelector('.challenge-q')?.textContent);
  const match = allQuestions.find((x) => x.question === q);
  const target = answerCorrect ? match?.correctAnswer : (await page.evaluate(() => [...document.querySelectorAll('.answer-btn')].map((b) => b.textContent.trim()))).find((a) => a !== match?.correctAnswer);
  await page.evaluate((a) => [...document.querySelectorAll('.answer-btn')].find((b) => b.textContent.trim() === a).click(), target);
}

try {
  await page.evaluateOnNewDocument((state) => {
    if (!sessionStorage.getItem('rh-seeded')) {
      localStorage.setItem('robot-hunt-save-v1', JSON.stringify({ state, version: 1 }));
      sessionStorage.setItem('rh-seeded', '1');
    }
  }, seedState);

  console.log('— seeded full collection (98/98) —');
  await page.goto(URL_BASE + '/#/collection', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => /98\s*\/\s*98/.test(document.querySelector('.collection-count')?.textContent ?? ''), { timeout: 8000 });
  check('seeded collection 98/98', true);
  check('progress bar complete class', await page.evaluate(() => Boolean(document.querySelector('.progress-fill.complete'))));
  await page.screenshot({ path: '/tmp/rh-09-full-collection.png' });

  console.log('— duplicate → BURN —');
  await runHunt(true);
  await waitFor(page, 'DUPLICATE!', 15000);
  check('DUPLICATE! stage', true);
  await page.screenshot({ path: '/tmp/rh-10-duplicate.png' });
  await page.evaluate(() => [...document.querySelectorAll('.result-actions .btn')].find((b) => b.textContent.includes('BURN')).click());
  await waitFor(page, '+1 ROBOT SCRAP', 6000);
  check('burn toast +1 ROBOT SCRAP', true);
  await waitFor(page, 'TAP TO OPEN');
  check('back to pack after burn', true);

  console.log('— duplicate → KEEP —');
  await page.click('.pack-wrap');
  await waitFor(page, 'HUMAN CHECK', 20000);
  const q = await page.evaluate(() => document.querySelector('.challenge-q')?.textContent);
  const match = allQuestions.find((x) => x.question === q);
  await page.evaluate((a) => [...document.querySelectorAll('.answer-btn')].find((b) => b.textContent.trim() === a).click(), match.correctAnswer);
  await waitFor(page, 'DUPLICATE!', 15000);
  await page.evaluate(() => [...document.querySelectorAll('.result-actions .btn')].find((b) => b.textContent.includes('KEEP')).click());
  await waitFor(page, 'KEPT — +1 COPY', 6000);
  check('keep toast', true);

  console.log('— profile shows scrap —');
  await page.goto(URL_BASE + '/#/profile', { waitUntil: 'networkidle0' });
  await waitFor(page, 'PLAYER');
  await page.waitForFunction(() => document.querySelectorAll('.stat-box').length >= 8, { timeout: 5000 });
  check('scrap = 1', await page.evaluate(() => {
    const box = [...document.querySelectorAll('.stat-box')].find((b) => b.textContent.includes('ROBOT SCRAP'));
    return box?.querySelector('.v')?.textContent?.trim() === '1';
  }));
  check('streak kept after wins', await page.evaluate(() => {
    const box = [...document.querySelectorAll('.stat-box')].find((b) => b.textContent.includes('STREAK'));
    return box?.querySelector('.v')?.textContent?.includes('5');
  }));

  console.log('— timeout (30s) —');
  await page.goto(URL_BASE + '/#/hunt', { waitUntil: 'networkidle0' });
  await waitFor(page, 'TAP TO OPEN');
  await page.click('.pack-wrap');
  await waitFor(page, 'HUMAN CHECK', 20000);
  const t0 = Date.now();
  await waitFor(page, 'TOO SLOW', 40000);
  check('timeout → TOO SLOW', true, `(took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  check('robot escaped copy', await page.evaluate(() => document.body.innerText.includes('ESCAPED')));
  await page.screenshot({ path: '/tmp/rh-11-too-slow.png' });

  const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('/api/') && !e.includes('Failed to load resource'));
  check('no console/page errors', realErrors.length === 0, `\n    ${realErrors.slice(0, 5).join('\n    ')}`);
} catch (e) {
  failed++;
  console.error('EXCEPTION:', e.message);
  await page.screenshot({ path: '/tmp/rh-failure2.png' }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
