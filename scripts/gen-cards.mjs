// Generates src/data/cards.generated.ts from the real robot images in public/robots/.
// Run with: npm run cards:gen
//
// Naming policy:
//   - Series and card labels are derived from the actual file names (no invented names).
//   - 26 cards carry the official descriptions shipped in the vibe/vibe site bundle
//     (https://testnet.vibevibe.fun, /vibe-vibers route) — verified 2026-09-28.
//   - Rarity and stats are deterministic (seeded PRNG), so re-runs are stable and
//     the distribution can be tuned in RARITY_WEIGHTS below.
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const robotsDir = join(root, 'public', 'robots');

// Verified against the official site bundle (vibers-Bep-TLBC.js), 2026-09-28.
// Keys are the file name WITHOUT the "vibe-vibers-" prefix.
const OFFICIAL_DESCRIPTIONS = {
  'viber-6': 'Brown Viber with little mint eyes and twin antennas',
  'viber-10': 'Green Viber with a cap and oversized turquoise glasses',
  'viber-32': 'Silver Viber with orange antennas and orange boots',
  'viber-31': 'Red Viber with a tall block mohawk',
  'viber-42': 'Orange Viber with a green hat and turquoise eyes',
  'viber-48': 'Teal Viber with a propeller hat and mint glasses',
  'viber-63': 'Brown Viber with purple glasses and a red mohawk',
  'viber-71': 'Brown pirate Viber with an eye patch',
  'viber-103': 'Gold-toned Viber with twin antennas and a striped chest',
  'viber-123': 'Purple Viber with a white cap and blue eyes',
  'viber-141': 'Dark Viber with a silver fedora and green glasses',
  'viber-142': 'Copper Viber with a brown fedora and coral eyes',
  'bureau-31': 'Turquoise Viber with glowing lime bars and a single antenna',
  'bureau-25': 'Charcoal Viber with a cream fedora and mint glasses',
  'bureau-24': 'Orange Viber with a black visor and wide boots',
  'bureau-23': 'Yellow Viber with a black cap and cream face bands',
  'bureau-8': 'Purple Viber with blue eyes and long black arms',
  'bureau-4': 'Cream Viber with a white fedora and blue glasses',
  'viber-84': 'Cream Viber with a red cap and red eyebrows',
  'viber-extra-24': 'Brown Viber with a white fedora and glowing gold eyes',
  'viber-extra-20': 'Sand-colored Viber with a red mohawk and red boots',
  'viber-extra-19': 'Brown Viber with a black top hat and a blue hatband',
  'viber-extra-15': 'Transparent turquoise Viber with a square smile',
  'viber-extra-12': 'Gold-toned Viber with glowing yellow eyes and a side antenna',
  'viber-extra-11': 'Brown Viber with glowing lime glasses and a red mouth',
  'viber-extra-9': 'Blue Viber with a brown hat and glowing gold eyes',
};

// Central rarity configuration — tune the percentages here.
const RARITY_WEIGHTS = { common: 48, uncommon: 25, rare: 15, epic: 7, legendary: 3 };

const SERIES = [
  { key: 'AGENTS', match: /^vibe-vibers-agent-/, label: 'AGENTS' },
  { key: 'BUREAU', match: /^vibe-vibers-bureau-roll-/, label: 'BUREAU ROLL' },
  { key: 'BUREAU', match: /^vibe-vibers-bureau-/, label: 'BUREAU' },
  { key: 'VIBERS', match: /^vibe-vibers-viber-extra-/, label: 'VIBER EXTRAS' },
  { key: 'VIBERS', match: /^vibe-vibers-viber-/, label: 'VIBERS' },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSeries(file) {
  for (const s of SERIES) if (s.match.test(file)) return s;
  return { key: 'VIBERS', label: 'VIBERS' };
}

function cardLabel(file) {
  file = file.replace(/\.png$/, '');
  const series = pickSeries(file);
  let suffix = '';
  if (file.startsWith('vibe-vibers-agent-')) suffix = file.replace('vibe-vibers-agent-', '');
  else if (file.startsWith('vibe-vibers-bureau-roll-')) suffix = file.replace('vibe-vibers-bureau-roll-', '');
  else if (file.startsWith('vibe-vibers-bureau-')) suffix = file.replace('vibe-vibers-bureau-', '');
  else if (file.startsWith('vibe-vibers-viber-extra-')) suffix = file.replace('vibe-vibers-viber-extra-', '');
  else suffix = file.replace('vibe-vibers-viber-', '');
  const pad = /^\d+$/.test(suffix) && suffix.length < 2 ? suffix.padStart(2, '0') : suffix;
  return `${series.label.replace(' ROLL', '')} ${pad.toUpperCase()}`;
}

const files = readdirSync(robotsDir)
  .filter((f) => f.endsWith('.png'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// Deterministic rarity assignment (shuffled slot bag with a fixed seed).
const bag = [];
for (const [rarity, count] of Object.entries(RARITY_WEIGHTS)) {
  for (let i = 0; i < count; i++) bag.push(rarity);
}
const rand = mulberry32(0x90b07); // "ROBOT" seed — stable across generations
for (let i = bag.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [bag[i], bag[j]] = [bag[j], bag[i]];
}

const statRand = mulberry32(99);
const stat = () => 30 + Math.floor(statRand() * 71);

const cards = files.map((file, i) => {
  const series = pickSeries(file);
  const officialKey = file.replace(/^vibe-vibers-/, '').replace(/\.png$/, '');
  const description = OFFICIAL_DESCRIPTIONS[officialKey] ?? null;
  return {
    id: String(i + 1).padStart(3, '0'),
    number: i + 1,
    file,
    image: `/robots/${file}`,
    name: cardLabel(file),
    description,
    series: series.label,
    rarity: bag[i],
    stats: { power: stat(), speed: stat(), spark: stat() },
    source: description ? 'official:vibevibe' : 'file-derived',
  };
});

const header = `// AUTO-GENERATED by scripts/gen-cards.mjs — do not edit by hand.
// Source: the real artwork files in public/robots/ (${cards.length} images).
// 26 cards include the official vibe/vibe descriptions (verified 2026-09-28).
// Rarity distribution is seeded-deterministic; tune it in scripts/gen-cards.mjs.
import type { RobotCard } from './types';

export const CARDS: RobotCard[] = ${JSON.stringify(cards, null, 2)};

export const TOTAL_CARDS = CARDS.length;
`;

writeFileSync(join(root, 'src', 'data', 'cards.generated.ts'), header);
console.log(`Generated ${cards.length} cards → src/data/cards.generated.ts`);
const counts = {};
for (const c of cards) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
console.log('Rarity:', counts);
const seriesCounts = {};
for (const c of cards) seriesCounts[c.series] = (seriesCounts[c.series] ?? 0) + 1;
console.log('Series:', seriesCounts);
