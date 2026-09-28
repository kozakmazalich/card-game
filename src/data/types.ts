// Core shared types for ROBOT HUNT.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CardStats {
  power: number;
  speed: number;
  spark: number;
}

export interface RobotCard {
  /** Card number, zero-padded: "001".."098" */
  id: string;
  /** 1-based card number */
  number: number;
  /** Original file name in public/robots/ (never renamed) */
  file: string;
  /** Public URL of the artwork */
  image: string;
  /** Display name, derived from the file name (see scripts/gen-cards.mjs) */
  name: string;
  /** Official vibe/vibe description where available, otherwise null */
  description: string | null;
  /** Series label, derived from the file name */
  series: string;
  /** Seeded-deterministic rarity (tune in scripts/gen-cards.mjs) */
  rarity: Rarity;
  stats: CardStats;
  /** Where the metadata came from */
  source: 'official:vibevibe' | 'file-derived';
}

export type QuestionCategory =
  | 'vibevibe'
  | 'robinhood'
  | 'meta_alchemist'
  | 'meta_alchemist_pfp'
  | 'x_posts'
  | 'spark'
  | 'gtd'
  | 'nft'
  | 'contract'
  | 'ecosystem'
  | 'current_event';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';

export interface Question {
  id: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  question: string;
  /** Displayed options — shuffled at render time */
  answers: string[];
  /** One of `answers`. Empty string = unverified draft. */
  correctAnswer: string;
  source: string;
  sourceUrl?: string;
  /** Only verified questions are ever served to players. */
  verified: boolean;
  /** Serve this question in challenges? */
  active: boolean;
  /** When the fact was last verified against its source. */
  verifiedAt?: string;
  /** For drafts: what still needs to be verified. */
  note?: string;
}

export interface SaveState {
  walletAddress: string | null;
  walletMode: 'mock' | 'injected' | null;
  /** Total claims, including duplicates */
  cardsClaimed: number;
  /** cardId -> copies owned */
  owned: Record<string, number>;
  /** Burned duplicates become scrap */
  scrap: number;
  streak: number;
  bestStreak: number;
  correct: number;
  wrong: number;
  timedOut: number;
  achievements: Record<string, number>;
  muted: boolean;
  firstRun: boolean;
}

export type ScreenId = 'home' | 'hunt' | 'collection' | 'profile' | 'leaderboard' | 'howtoplay';

export interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'info' | 'rare';
}
