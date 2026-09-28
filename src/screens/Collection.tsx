import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CARDS, RARITY_LIST, SERIES_LIST, TOTAL_CARDS } from '../data/cards';
import type { Rarity } from '../data/types';
import { useGame } from '../game/store';
import RobotCard from '../components/RobotCard';
import CountUp from '../components/CountUp';

type OwnedFilter = 'all' | 'owned' | 'missing';

export default function Collection() {
  const owned = useGame((s) => s.owned);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [seriesFilter, setSeriesFilter] = useState<string>('all');

  const unique = Object.keys(owned).length;

  const rarityCounts = useMemo(() => {
    const map: Record<string, { owned: number; total: number }> = {};
    for (const r of RARITY_LIST) map[r] = { owned: 0, total: 0 };
    for (const c of CARDS) {
      map[c.rarity].total += 1;
      if (owned[c.id]) map[c.rarity].owned += 1;
    }
    return map;
  }, [owned]);

  const visible = useMemo(
    () =>
      CARDS.filter((c) => {
        const has = (owned[c.id] ?? 0) > 0;
        if (ownedFilter === 'owned' && !has) return false;
        if (ownedFilter === 'missing' && has) return false;
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false;
        if (seriesFilter !== 'all' && c.series !== seriesFilter) return false;
        return true;
      }),
    [owned, ownedFilter, rarityFilter, seriesFilter],
  );

  const pct = Math.round((unique / TOTAL_CARDS) * 100);

  return (
    <div className="collection">
      <div className="collection-head">
        <div>
          <h1 className="collection-title">MY ROBOT COLLECTION</h1>
          <p className="collection-count">
            <strong>
              <CountUp value={unique} />
            </strong>{' '}
            / {TOTAL_CARDS} · {pct}% COMPLETE
          </p>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={unique} aria-valuemin={0} aria-valuemax={TOTAL_CARDS} aria-label="Collection progress">
          <motion.div
            className={`progress-fill${unique === TOTAL_CARDS ? ' complete' : ''}`}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
          />
        </div>
        <div className="rarity-bars">
          {RARITY_LIST.map((r) => (
            <div key={r} className="rarity-bar">
              <div className="rb-top">
                <span className={`rc r-${r}`}>{r}</span>
                <span>
                  {rarityCounts[r].owned}/{rarityCounts[r].total}
                </span>
              </div>
              <div className="track">
                <motion.div
                  className="fill"
                  style={{ background: `var(--r-${r})` }}
                  initial={false}
                  animate={{ width: `${rarityCounts[r].total ? (rarityCounts[r].owned / rarityCounts[r].total) * 100 : 0}%` }}
                  transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="filters">
        {(
          [
            ['all', 'ALL'],
            ['owned', 'OWNED'],
            ['missing', 'MISSING'],
          ] as [OwnedFilter, string][]
        ).map(([id, label]) => (
          <button key={id} className={`chip${ownedFilter === id ? ' active' : ''}`} onClick={() => setOwnedFilter(id)}>
            {label}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {RARITY_LIST.map((r) => (
          <button
            key={r}
            className={`chip rarity r-${r}${rarityFilter === r ? ' active' : ''}`}
            onClick={() => setRarityFilter(rarityFilter === r ? 'all' : r)}
          >
            {r}
          </button>
        ))}
        <span style={{ width: 8 }} />
        <button className={`chip${seriesFilter === 'all' ? ' active' : ''}`} onClick={() => setSeriesFilter('all')}>
          ALL SERIES
        </button>
        {SERIES_LIST.map((s) => (
          <button key={s} className={`chip${seriesFilter === s ? ' active' : ''}`} onClick={() => setSeriesFilter(seriesFilter === s ? 'all' : s)}>
            {s}
          </button>
        ))}
      </div>

      <motion.div layout className="collection-grid">
        <AnimatePresence>
          {visible.map((c) => {
            const count = owned[c.id] ?? 0;
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <RobotCard card={c} ownedCount={count} missing={count === 0} />
              </motion.div>
            );
          })}
        </AnimatePresence>
        {visible.length === 0 && (
          <div className="empty-note">
            NOTHING HERE — KEEP HUNTING
            <br />
            🤖
          </div>
        )}
      </motion.div>
    </div>
  );
}
