import { CARDS, TOTAL_CARDS } from '../data/cards.generated';
import { pickQuestion } from '../data/questions';
import type { Question, Rarity, RobotCard } from '../data/types';

export const RARITY_LIST: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export { CARDS, TOTAL_CARDS };

export const CARD_BY_ID: ReadonlyMap<string, RobotCard> = new Map(CARDS.map((c) => [c.id, c]));

/** Unique series in dataset order. */
export const SERIES_LIST: string[] = [...new Set(CARDS.map((c) => c.series))];

export function getCard(cardId: string): RobotCard | undefined {
  return CARD_BY_ID.get(cardId);
}

/**
 * Client-side random card selection for the prototype.
 *
 * NOT secure and NOT an NFT allocation — later this becomes a call to a
 * backend / on-chain VRF-compatible reward service without changing the UI.
 */
export function selectRandomCard(): RobotCard {
  return CARDS[Math.floor(Math.random() * CARDS.length)];
}

/** Picks a human challenge appropriate for the card rarity. */
export function selectChallengeFor(card: RobotCard, excludeIds: string[] = []): Question | null {
  return pickQuestion(card.rarity, excludeIds);
}
