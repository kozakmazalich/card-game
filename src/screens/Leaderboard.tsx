import { useMemo, useState } from 'react';
import { CARDS, getCard } from '../data/cards';
import { useGame } from '../game/store';
import { shortAddress } from '../game/wallet';

type Board = 'robots' | 'streak' | 'rare' | 'epic' | 'legendary';

const BOARDS: { id: Board; label: string }[] = [
  { id: 'robots', label: 'MOST ROBOTS' },
  { id: 'streak', label: 'LONGEST STREAK' },
  { id: 'rare', label: 'MOST RARE' },
  { id: 'epic', label: 'MOST EPIC' },
  { id: 'legendary', label: 'MOST LEGENDARY' },
];

interface Row {
  name: string;
  avatar: string;
  score: number;
  isYou?: boolean;
}

const MOCK_NAMES = ['SparkyWins', 'R0B0_COLLECTR', 'mint_or_miss', 'ChainChaser', 'viber_king', '0xLucky', 'Huntress99', 'GweiLover'];

function mockRows(board: Board): Row[] {
  const rng = (i: number) => {
    const x = Math.sin(i * 9301 + 49297) * 233280;
    return Math.abs(Math.floor(x));
  };
  return MOCK_NAMES.map((name, i) => {
    const base = board === 'robots' ? 40 : board === 'streak' ? 5 : 3;
    const score = Math.max(1, base - i * (board === 'robots' ? 3 : 1) + (rng(i) % 4));
    return { name, avatar: CARDS[(rng(i) * 7) % CARDS.length].image, score };
  }).sort((a, b) => b.score - a.score);
}

export default function Leaderboard() {
  const [board, setBoard] = useState<Board>('robots');
  const owned = useGame((s) => s.owned);
  const streak = useGame((s) => s.streak);
  const walletAddress = useGame((s) => s.walletAddress);

  const you = useMemo(() => {
    const ids = Object.keys(owned);
    const count = (r: string) => ids.filter((id) => getCard(id)?.rarity === r).length;
    const score =
      board === 'robots'
        ? ids.length
        : board === 'streak'
          ? streak
          : board === 'rare'
            ? count('rare')
            : board === 'epic'
              ? count('epic')
              : count('legendary');
    const avatar = ids.length ? getCard(ids[0])!.image : CARDS[0].image;
    return { name: walletAddress ? `YOU · ${shortAddress(walletAddress)}` : 'YOU (OFFLINE)', avatar, score, isYou: true } as Row;
  }, [board, owned, streak, walletAddress]);

  const rows = useMemo(() => {
    const m = mockRows(board);
    const all = [...m, you].sort((a, b) => b.score - a.score).slice(0, 10);
    return all;
  }, [board, you]);

  return (
    <div>
      <h1 className="collection-title">LEADERBOARD</h1>
      <p className="collection-count" style={{ marginBottom: 16 }}>
        <strong>MOCK DATA</strong> · REAL RANKINGS COME WITH THE BACKEND
      </p>

      <div className="lb-tabs">
        {BOARDS.map((b) => (
          <button key={b.id} className={`chip${board === b.id ? ' active' : ''}`} onClick={() => setBoard(b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      <div className="lb-table">
        {rows.map((r, i) => (
          <div key={`${r.name}-${i}`} className={`lb-row${r.isYou ? ' you' : ''}`}>
            <span className={`lb-rank${i < 3 ? ' top' : ''}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div className="lb-who">
              <span className="lb-avatar">
                <img src={r.avatar} alt="" loading="lazy" />
              </span>
              <span className={`lb-name${r.isYou ? ' you-tag' : ''}`}>{r.name}</span>
            </div>
            <span className="lb-score">{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
