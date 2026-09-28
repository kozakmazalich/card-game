// Server-side question pool. Answers stay server-side: the client only ever
// receives the question and its answer options, never which one is correct.
import vibevibe from '../../src/data/questions/vibevibe.json' with { type: 'json' };
import robinhood from '../../src/data/questions/robinhood.json' with { type: 'json' };
import spark from '../../src/data/questions/spark.json' with { type: 'json' };
import metaAlchemist from '../../src/data/questions/meta-alchemist.json' with { type: 'json' };
import nft from '../../src/data/questions/nft.json' with { type: 'json' };
import xPosts from '../../src/data/questions/x-posts.json' with { type: 'json' };
import gtd from '../../src/data/questions/gtd.json' with { type: 'json' };
import contract from '../../src/data/questions/contract.json' with { type: 'json' };

const ALL = [
  ...(vibevibe as any[]),
  ...(robinhood as any[]),
  ...(spark as any[]),
  ...(metaAlchemist as any[]),
  ...(nft as any[]),
  ...(xPosts as any[]),
  ...(gtd as any[]),
  ...(contract as any[]),
];

export const ACTIVE = ALL.filter(
  (q) =>
    q.active &&
    q.verified &&
    typeof q.correctAnswer === 'string' &&
    q.correctAnswer.length > 0 &&
    Array.isArray(q.answers) &&
    q.answers.includes(q.correctAnswer),
);

export const RARITY_DIFFICULTY: Record<string, string[]> = {
  common: ['easy'],
  uncommon: ['easy', 'medium'],
  rare: ['medium', 'hard'],
  epic: ['hard', 'legendary'],
  legendary: ['legendary', 'hard'],
};

export function pickQuestion(rarity: string, excludeIds: string[] = []) {
  const allowed = RARITY_DIFFICULTY[rarity] ?? ['easy', 'medium'];
  let pool = ACTIVE.filter((q) => !excludeIds.includes(q.id) && allowed.includes(q.difficulty));
  if (pool.length === 0) pool = ACTIVE.filter((q) => !excludeIds.includes(q.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function shuffleAnswers(q: any): string[] {
  const out = [...q.answers];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function findQuestion(id: string) {
  return ACTIVE.find((q) => q.id === id) ?? null;
}
