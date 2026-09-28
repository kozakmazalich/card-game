import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CARDS, getCard, TOTAL_CARDS } from '../data/cards';
import { useGame } from '../game/store';
import { shortAddress } from '../game/wallet';

type Board = 'robots' | 'streak' | 'rare' | 'epic' | 'legendary';

const BOARDS: { id: Board; label: string; icon: string }[] = [
  { id: 'robots', label: 'MOST ROBOTS', icon: '🤖' },
  { id: 'streak', label: 'LONGEST STREAK', icon: '🔥' },
  { id: 'rare', label: 'MOST RARE', icon: '💎' },
  { id: 'epic', label: 'MOST EPIC', icon: '⚡' },
  { id: 'legendary', label: 'MOST LEGENDARY', icon: '👑' },
];

interface Row {
  name: string;
  avatar: string;
  score: number;
  streak: number;
  rare: number;
  epic: number;
  legendary: number;
  progress: number; // 0..100
  preview: string[];
  isYou?: boolean;
}

const MOCK_NAMES = ['SparkyWins', 'R0B0_COLLECTR', 'mint_or_miss', 'ChainChaser', 'viber_king', '0xLucky', 'Huntress99', 'GweiLover'];

const rng = (i: number) => {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return Math.abs(Math.floor(x));
};

function mockRows(board: Board): Row[] {
  return MOCK_NAMES.map((name, i) => {
    const base = board === 'robots' ? 40 : board === 'streak' ? 5 : 3;
    const score = Math.max(1, base - i * (board === 'robots' ? 3 : 1) + (rng(i) % 4));
    const preview = [CARDS[rng(i) % CARDS.length], CARDS[rng(i + 3) % CARDS.length], CARDS[rng(i + 7) % CARDS.length]].map((c) => c.image);
    return {
      name,
      avatar: preview[0],
      score,
      streak: 2 + (rng(i + 1) % 12),
      rare: rng(i + 2) % 16,
      epic: rng(i + 4) % 8,
      legendary: rng(i + 5) % 4,
      progress: 12 + (rng(i + 9) % 87),
      preview,
    };
  }).sort((a, b) => b.score - a.score);
}

const RANK_META = [
  { cls: 'p1', badge: '👑', label: '1ST' },
  { cls: 'p2', badge: '🥈', label: '2ND' },
  { cls: 'p3', badge: '🥉', label: '3RD' },
];

function RarityChips({ r, small = false }: { r: Row; small?: boolean }) {
  return (
    <span className={`lb-chips${small ? ' small' : ''}`}>
      <span className="lb-chip r-rare">💎 {r.rare}</span>
      <span className="lb-chip r-epic">⚡ {r.epic}</span>
      <span className="lb-chip r-legendary">👑 {r.legendary}</span>
      <span className="lb-chip streak">🔥 {r.streak}</span>
    </span>
  );
}

export default function Leaderboard() {
  const [board, setBoard] = useState<Board>('robots');
  const owned = useGame((s) => s.owned);
  const streak = useGame((s) => s.streak);
  const walletAddress = useGame((s) => s.walletAddress);

  const you = useMemo<Row>(() => {
    const ids = Object.keys(owned).sort((a, b) => Number(a) - Number(b));
    const count = (r: string) => ids.filter((id) => getCard(id)?.rarity === r).length;
    const score =
      board === 'robots' ? ids.length : board === 'streak' ? streak : board === 'rare' ? count('rare') : board === 'epic' ? count('epic') : count('legendary');
    const preview = ids.slice(0, 3).map((id) => getCard(id)!.image);
    return {
      name: walletAddress ? `YOU · ${shortAddress(walletAddress)}` : 'YOU (OFFLINE)',
      avatar: preview[0] ?? CARDS[0].image,
      score,
      streak,
      rare: count('rare'),
      epic: count('epic'),
      legendary: count('legendary'),
      progress: Math.round((ids.length / TOTAL_CARDS) * 100),
      preview: preview.length ? preview : [CARDS[0].image, CARDS[1].image, CARDS[2].image],
      isYou: true,
    };
  }, [board, owned, streak, walletAddress]);

  const rows = useMemo(() => [...mockRows(board), you].sort((a, b) => b.score - a.score).slice(0, 10), [board, you]);
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const rest = rows.slice(3);

  return (
    <div className="lb">
      <h1 className="collection-title">LEADERBOARD</h1>
      <p className="collection-count" style={{ marginBottom: 16 }}>
        <strong>MOCK DATA</strong> · REAL RANKINGS COME WITH THE BACKEND
      </p>

      <div className="lb-tabs">
        {BOARDS.map((b) => (
          <button key={b.id} className={`chip lb-tab${board === b.id ? ' active' : ''}`} onClick={() => setBoard(b.id)}>
            <span aria-hidden="true">{b.icon}</span> {b.label}
          </button>
        ))}
      </div>

      {/* Podium — top 3 */}
      <div className="lb-podium">
        {podium.map((r, i) => {
          const meta = RANK_META[i];
          return (
            <motion.div
              key={`${r.name}-${i}`}
              className={`lb-podium-card ${meta.cls}${r.isYou ? ' you' : ''}`}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className="lb-rank-badge" aria-hidden="true">
                {meta.badge}
              </span>
              <span className="lb-avatar-ring">
                <img src={r.avatar} alt="" loading="lazy" />
              </span>
              <span className={`lb-name${r.isYou ? ' you-tag' : ''}`}>{r.name}</span>
              <span className="lb-score">
                <CountUpValue value={r.score} />
              </span>
              <RarityChips r={r} small />
              <span className="lb-mini-track">
                <span className="lb-mini-fill" style={{ width: `${r.progress}%` }} />
              </span>
              <span className="lb-progress-label">{r.progress}% COLLECTED</span>
            </motion.div>
          );
        })}
      </div>

      {/* Ranks 4+ */}
      <div className="lb-list">
        {rest.map((r, i) => (
          <motion.div
            key={`${r.name}-${i}`}
            className={`lb-row${r.isYou ? ' you' : ''}`}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="lb-rank">{String(i + 4).padStart(2, '0')}</span>
            <span className="lb-avatar">
              <img src={r.avatar} alt="" loading="lazy" />
            </span>
            <span className={`lb-who`}>
              <span className={`lb-name${r.isYou ? ' you-tag' : ''}`}>{r.name}</span>
              <span className="lb-progress">
                <span className="lb-mini-fill" style={{ width: `${r.progress}%` }} />
              </span>
            </span>
            <span className="lb-previews">
              {r.preview.map((p, j) => (
                <img key={j} src={p} alt="" loading="lazy" />
              ))}
            </span>
            <RarityChips r={r} small />
            <span className="lb-score">{r.score}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CountUpValue({ value }: { value: number }) {
  return <span className="lb-score-num">{value}</span>;
}
