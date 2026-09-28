import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RobotCard, SaveState } from '../data/types';
import { getCard } from '../data/cards';
import { buildAchievements } from './achievements';

const ACHIEVEMENTS = buildAchievements((id) => getCard(id));

const INITIAL: SaveState = {
  walletAddress: null,
  walletMode: null,
  cardsClaimed: 0,
  owned: {},
  scrap: 0,
  streak: 0,
  bestStreak: 0,
  correct: 0,
  wrong: 0,
  timedOut: 0,
  achievements: {},
  muted: false,
  firstRun: true,
};

export interface GameStore extends SaveState {
  setWallet: (address: string | null, mode?: 'mock' | 'injected' | null) => void;
  toggleMute: () => void;
  claimCard: (card: RobotCard) => { isNew: boolean };
  burnDuplicate: (cardId: string) => boolean;
  recordWin: () => void;
  recordLoss: (timedOut: boolean) => void;
  markSeen: () => void;
  resetGame: () => void;
}

function applyAchievements(state: GameStore, at: number) {
  for (const a of ACHIEVEMENTS) {
    if (a.check(state) && !state.achievements[a.id]) {
      state.achievements[a.id] = at;
    }
  }
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      setWallet: (address: string | null, mode: 'mock' | 'injected' | null = null) =>
        set({ walletAddress: address, walletMode: address ? mode : null }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      claimCard: (card) => {
        const s = get();
        const had = (s.owned[card.id] ?? 0) > 0;
        const owned = { ...s.owned, [card.id]: (s.owned[card.id] ?? 0) + 1 };
        const next: GameStore = {
          ...s,
          owned,
          cardsClaimed: s.cardsClaimed + 1,
        };
        applyAchievements(next, Date.now());
        set(next);
        return { isNew: !had };
      },
      burnDuplicate: (cardId) => {
        const s = get();
        const count = s.owned[cardId] ?? 0;
        if (count <= 0) return false;
        const owned = { ...s.owned };
        if (count === 1) delete owned[cardId];
        else owned[cardId] = count - 1;
        const next: GameStore = { ...s, owned, scrap: s.scrap + 1 };
        applyAchievements(next, Date.now());
        set(next);
        return true;
      },
      recordWin: () => {
        const s = get();
        const streak = s.streak + 1;
        const next: GameStore = {
          ...s,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          correct: s.correct + 1,
        };
        applyAchievements(next, Date.now());
        set(next);
      },
      recordLoss: (timedOut) => {
        const s = get();
        const next: GameStore = {
          ...s,
          streak: 0,
          wrong: s.wrong + (timedOut ? 0 : 1),
          timedOut: s.timedOut + (timedOut ? 1 : 0),
        };
        applyAchievements(next, Date.now());
        set(next);
      },
      markSeen: () => set({ firstRun: false }),
      resetGame: () => set({ ...INITIAL, muted: get().muted }),
    }),
    {
      name: 'robot-hunt-save-v1',
      version: 1,
    },
  ),
);

export { ACHIEVEMENTS };

export function useOwnedCounts(): { unique: number; copies: number } {
  return useGame((s) => {
    const owned = s.owned;
    const entries = Object.values(owned);
    return { unique: entries.length, copies: entries.reduce((a, b) => a + b, 0) };
  });
}
