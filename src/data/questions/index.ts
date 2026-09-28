import type { Question, QuestionCategory, QuestionDifficulty, Rarity } from '../types';

export type { Question, QuestionCategory, QuestionDifficulty };

import vibevibe from './vibevibe.json';
import robinhood from './robinhood.json';
import spark from './spark.json';
import metaAlchemist from './meta-alchemist.json';
import nft from './nft.json';
import xPosts from './x-posts.json';
import gtd from './gtd.json';
import contract from './contract.json';

const ALL_QUESTIONS: Question[] = [
  ...vibevibe,
  ...robinhood,
  ...spark,
  ...metaAlchemist,
  ...nft,
  ...xPosts,
  ...gtd,
  ...contract,
] as Question[];

/** Questions that may be served to players: verified + active + answered. */
export const ACTIVE_QUESTIONS: Question[] = ALL_QUESTIONS.filter(
  (q) => q.active && q.verified && q.correctAnswer.length > 0 && q.answers.some((a) => a === q.correctAnswer),
);

/** Drafts — kept in the database for the product owner to populate/verify. */
export const DRAFT_QUESTIONS: Question[] = ALL_QUESTIONS.filter((q) => !ACTIVE_QUESTIONS.includes(q));

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  vibevibe: 'vibe/vibe',
  robinhood: 'Robinhood Chain',
  meta_alchemist: 'Meta Alchemist',
  meta_alchemist_pfp: 'Meta Alchemist PFP',
  x_posts: 'X posts',
  spark: '$SPARK',
  gtd: 'GTD',
  nft: 'NFT details',
  contract: 'Contracts',
  ecosystem: 'Ecosystem',
  current_event: 'Current events',
};

/** Higher rarity → harder allowed challenges. */
export const RARITY_DIFFICULTY: Record<Rarity, QuestionDifficulty[]> = {
  common: ['easy'],
  uncommon: ['easy', 'medium'],
  rare: ['medium', 'hard'],
  epic: ['hard', 'legendary'],
  legendary: ['legendary', 'hard'],
};

export function questionPoolFor(rarity: Rarity, excludeIds: string[] = []): Question[] {
  const allowed = RARITY_DIFFICULTY[rarity];
  let pool = ACTIVE_QUESTIONS.filter((q) => !excludeIds.includes(q.id) && allowed.includes(q.difficulty));
  if (pool.length === 0) pool = ACTIVE_QUESTIONS.filter((q) => !excludeIds.includes(q.id));
  return pool;
}

export function pickQuestion(rarity: Rarity, excludeIds: string[] = []): Question | null {
  const pool = questionPoolFor(rarity, excludeIds);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function shuffleAnswers(q: Question): string[] {
  const out = [...q.answers];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const QUESTION_STATS = {
  active: ACTIVE_QUESTIONS.length,
  drafts: DRAFT_QUESTIONS.length,
};
