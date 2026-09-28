import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RARITY_LIST, TOTAL_CARDS, getCard } from '../data/cards';
import { useGame, ACHIEVEMENTS } from '../game/store';
import { shortAddress } from '../game/wallet';
import { useToasts } from '../game/toasts';
import { sfx } from '../game/sounds';
import { navigate } from '../game/router';
import CountUp from '../components/CountUp';

export default function Profile() {
  const owned = useGame((s) => s.owned);
  const walletAddress = useGame((s) => s.walletAddress);
  const walletMode = useGame((s) => s.walletMode);
  const streak = useGame((s) => s.streak);
  const cardsClaimed = useGame((s) => s.cardsClaimed);
  const scrap = useGame((s) => s.scrap);
  const achievements = useGame((s) => s.achievements);
  const resetGame = useGame((s) => s.resetGame);
  const push = useToasts((s) => s.push);
  const [confirmReset, setConfirmReset] = useState(false);

  const unique = Object.keys(owned).length;

  const firstOwned = useMemo(() => {
    const id = Object.keys(owned)[0];
    return id ? getCard(id) : null;
  }, [owned]);

  const rarityOwned = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of RARITY_LIST) map[r] = 0;
    for (const id of Object.keys(owned)) {
      const c = getCard(id);
      if (c) map[c.rarity] += 1;
    }
    return map;
  }, [owned]);

  const doReset = () => {
    sfx.burn();
    resetGame();
    push('GAME RESET — FRESH START', 'info');
    setConfirmReset(false);
    navigate('home');
  };

  return (
    <div className="profile">
      <section className="panel profile-head">
        <div className="profile-avatar" aria-hidden="true">
          {firstOwned ? <img src={firstOwned.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} /> : '👾'}
        </div>
        <div>
          <h1 className="profile-name">PLAYER</h1>
          <div className="profile-addr">
            {walletAddress ? shortAddress(walletAddress) : 'NO WALLET CONNECTED'}
            {walletMode === 'mock' && <span className="mock-tag">MOCK</span>}
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Player stats">
        <div className="panel stat-box">
          <div className="v green">
            <CountUp value={unique} />/{TOTAL_CARDS}
          </div>
          <div className="k">COLLECTION</div>
        </div>
        <div className="panel stat-box">
          <div className="v amber">🔥 {streak}</div>
          <div className="k">STREAK</div>
        </div>
        <div className="panel stat-box">
          <div className="v">{cardsClaimed}</div>
          <div className="k">CARDS CLAIMED</div>
        </div>
        <div className="panel stat-box">
          <div className="v">{unique}</div>
          <div className="k">UNIQUE ROBOTS</div>
        </div>
        <div className="panel stat-box">
          <div className="v lime">{scrap}</div>
          <div className="k">ROBOT SCRAP</div>
        </div>
        <div className="panel stat-box">
          <div className="v iris">{rarityOwned.rare}</div>
          <div className="k">RARE</div>
        </div>
        <div className="panel stat-box">
          <div className="v amber">{rarityOwned.epic}</div>
          <div className="k">EPIC</div>
        </div>
        <div className="panel stat-box">
          <div className="v lime">{rarityOwned.legendary}</div>
          <div className="k">LEGENDARY</div>
        </div>
      </section>

      <section className="panel mini-panel">
        <h3>COLLECTION PROGRESS</h3>
        <div className="progress-track" role="progressbar" aria-valuenow={unique} aria-valuemax={TOTAL_CARDS}>
          <motion.div
            className={`progress-fill${unique === TOTAL_CARDS ? ' complete' : ''}`}
            initial={false}
            animate={{ width: `${Math.round((unique / TOTAL_CARDS) * 100)}%` }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
          />
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5 }}>
          {TOTAL_CARDS - unique} ROBOTS STILL OUT THERE…
        </p>
      </section>

      <section aria-label="Achievements">
        <h3 className="collection-title" style={{ fontSize: 20, margin: '0 0 12px' }}>
          ACHIEVEMENTS
        </h3>
        <div className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = Boolean(achievements[a.id]);
            return (
              <div key={a.id} className={`ach${unlocked ? '' : ' locked'}`}>
                <span className="ach-emoji" aria-hidden="true">
                  {unlocked ? a.emoji : '🔒'}
                </span>
                <div>
                  <div className="ach-title">{a.title}</div>
                  <div className="ach-blurb">{a.blurb}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel profile-danger">
        <h3>DANGER ZONE</h3>
        {confirmReset ? (
          <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
            <span style={{ color: 'var(--danger)', fontSize: 13 }}>Wipe your whole collection?</span>
            <button className="btn btn-danger" onClick={doReset}>
              YES, RESET
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              CANCEL
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmReset(true)}>
            RESET GAME
          </button>
        )}
      </section>
    </div>
  );
}
