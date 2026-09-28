import type { RobotCard as RobotCardType } from '../data/types';

const STAR_MAP: Record<string, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
};

interface Props {
  card: RobotCardType;
  ownedCount?: number;
  locked?: boolean;
  missing?: boolean;
  size?: 'grid' | 'showcase';
  className?: string;
}

export default function RobotCard({ card, ownedCount = 0, locked = false, missing = false, size = 'grid', className = '' }: Props) {
  const stars = STAR_MAP[card.rarity] ?? '★';
  const cls = [
    'robot-card',
    missing ? 'missing' : `rarity-${card.rarity}`,
    locked ? 'locked' : '',
    size === 'showcase' ? 'showcase' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cls} aria-label={missing ? `Undiscovered robot #${card.id}` : `${card.name}, ${card.rarity}`}>
      <div className="rc-head">
        <span className="rc-series">{card.series}</span>
        <span className="rc-num">#{card.id}</span>
      </div>
      <div className="rc-art">
        {missing ? (
          <>
            <span className="q">?</span>
            <span className="un">UNKNOWN</span>
          </>
        ) : (
          <img src={card.image} alt={card.name} loading="lazy" decoding="async" draggable={false} />
        )}
        {locked && (
          <div className="lock-overlay">
            <span className="lock-ico" role="img" aria-label="Locked">
              🔒
            </span>
            <span className="lock-word">CARD LOCKED</span>
          </div>
        )}
      </div>
      {!missing && (
        <>
          <div className="rc-name" title={card.name}>
            {card.name}
          </div>
          <div className="rc-meta">
            <span className="rc-rarity">{card.rarity}</span>
            <span className="rc-stars" aria-label={`${stars.length} star rarity`}>
              {stars}
            </span>
          </div>
          <div className="rc-stats">
            <span className="rc-stat">
              <span className="k">PWR</span>
              <span className="v">{card.stats.power}</span>
            </span>
            <span className="rc-stat">
              <span className="k">SPD</span>
              <span className="v">{card.stats.speed}</span>
            </span>
            <span className="rc-stat">
              <span className="k">SPK</span>
              <span className="v">{card.stats.spark}</span>
            </span>
          </div>
        </>
      )}
      {missing && (
        <div className="rc-meta" style={{ justifyContent: 'center', paddingBottom: 10 }}>
          <span className="rc-rarity">UNDISCOVERED</span>
        </div>
      )}
      {ownedCount > 0 && !missing && <span className="rc-owned">×{ownedCount}</span>}
    </article>
  );
}
