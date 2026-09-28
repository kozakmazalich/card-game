import type { SaveState } from '../data/types';
import { TOTAL_CARDS } from '../data/cards';

export interface AchievementDef {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  check: (s: Pick<SaveState, 'owned' | 'streak' | 'scrap'>) => boolean;
}

const uniqueCount = (owned: Record<string, number>) => Object.keys(owned).length;
const rarityCount = (owned: Record<string, number>, rarity: string, cardOf: (id: string) => { rarity: string } | undefined) =>
  Object.keys(owned).filter((id) => cardOf(id)?.rarity === rarity).length;

export function buildAchievements(cardOf: (id: string) => { rarity: string } | undefined): AchievementDef[] {
  return [
    {
      id: 'first_robot',
      title: 'FIRST ROBOT',
      blurb: 'Claim your first card.',
      emoji: '🤖',
      check: (s) => uniqueCount(s.owned) >= 1,
    },
    {
      id: 'ten_robots',
      title: '10 ROBOTS',
      blurb: 'Own 10 different robots.',
      emoji: '🎯',
      check: (s) => uniqueCount(s.owned) >= 10,
    },
    {
      id: 'half_way',
      title: 'HALF WAY',
      blurb: `Own ${Math.ceil(TOTAL_CARDS / 2)}/${TOTAL_CARDS}.`,
      emoji: '⚡',
      check: (s) => uniqueCount(s.owned) >= Math.ceil(TOTAL_CARDS / 2),
    },
    {
      id: 'rare_finder',
      title: 'RARE FINDER',
      blurb: 'Own 5 rare cards.',
      emoji: '💎',
      check: (s) => rarityCount(s.owned, 'rare', cardOf) >= 5,
    },
    {
      id: 'epic_hunter',
      title: 'EPIC HUNTER',
      blurb: 'Own an epic card.',
      emoji: '🔥',
      check: (s) => rarityCount(s.owned, 'epic', cardOf) >= 1,
    },
    {
      id: 'legendary',
      title: 'LEGENDARY',
      blurb: 'Own a legendary card.',
      emoji: '👑',
      check: (s) => rarityCount(s.owned, 'legendary', cardOf) >= 1,
    },
    {
      id: 'streak_5',
      title: 'HUMAN STREAK 5',
      blurb: 'Win 5 challenges in a row.',
      emoji: '🧠',
      check: (s) => s.streak >= 5,
    },
    {
      id: 'scrapper',
      title: 'SCRAPPER',
      blurb: 'Burn 10 duplicates into scrap.',
      emoji: '♻️',
      check: (s) => s.scrap >= 10,
    },
    {
      id: 'robot_master',
      title: 'ROBOT MASTER',
      blurb: `Collect all ${TOTAL_CARDS}.`,
      emoji: '🏆',
      check: (s) => uniqueCount(s.owned) >= TOTAL_CARDS,
    },
  ];
}
