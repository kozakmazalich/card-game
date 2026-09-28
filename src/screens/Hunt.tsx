import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CARDS, selectRandomCard, TOTAL_CARDS } from '../data/cards';
import { CATEGORY_LABELS } from '../data/questions';
import { fetchChallenge, submitAnswer, type ChallengePayload, type ClaimProof } from '../game/api';
import type { RobotCard as RobotCardType } from '../data/types';
import { useGame } from '../game/store';
import { useToasts } from '../game/toasts';
import { sfx } from '../game/sounds';
import { claimCardLocal } from '../game/wallet';
import { claimOnChain, claimTxExplorerUrl, isContractReady } from '../game/contract';
import { navigate } from '../game/router';
import RobotCard from '../components/RobotCard';
import { ParticleBurst, FailureFlash } from '../components/Particles';

const CHALLENGE_SECONDS = 30;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type Stage =
  | { kind: 'pack' }
  | { kind: 'shuffling'; card: RobotCardType }
  | { kind: 'locked'; card: RobotCardType; challenge: ChallengePayload }
  | { kind: 'unlocking'; card: RobotCardType; proof: ClaimProof | null }
  | { kind: 'acquired'; card: RobotCardType; isNew: boolean; onChain: boolean }
  | { kind: 'duplicate'; card: RobotCardType }
  | { kind: 'escaped'; card: RobotCardType; reason: 'wrong' | 'timeout'; correctAnswer: string | null };

export default function Hunt() {
  const [stage, setStage] = useState<Stage>({ kind: 'pack' });
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_SECONDS);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  const walletAddress = useGame((s) => s.walletAddress);
  const walletMode = useGame((s) => s.walletMode);
  const owned = useGame((s) => s.owned);
  const claimCard = useGame((s) => s.claimCard);
  const recordWin = useGame((s) => s.recordWin);
  const recordLoss = useGame((s) => s.recordLoss);
  const burnDuplicate = useGame((s) => s.burnDuplicate);
  const push = useToasts((s) => s.push);

  const unique = Object.keys(owned).length;

  const startShuffle = useCallback(() => {
    const card = selectRandomCard();
    const player = walletAddress ?? ZERO_ADDRESS;
    setStage({ kind: 'shuffling', card });
    sfx.shuffle();
    const steps = 15;
    let acc = 200;
    for (let i = 0; i <= steps; i++) {
      acc += 55 + i * i * 2.4;
      const idx = i;
      const t = window.setTimeout(async () => {
        if (idx < steps) {
          setShuffleIndex(Math.floor(Math.random() * CARDS.length));
          sfx.tick();
          return;
        }
        try {
          const challenge = await fetchChallenge({ cardId: card.number, rarity: card.rarity, player, excludeIds: [] });
          setStage({ kind: 'locked', card, challenge });
          sfx.lock();
        } catch {
          setStage({ kind: 'pack' });
          push('CHALLENGE DATABASE EMPTY', 'warn');
        }
      }, acc);
      timeoutsRef.current.push(t);
    }
  }, [walletAddress, push]);

  useEffect(() => {
    return () => timeoutsRef.current.forEach((t) => window.clearTimeout(t));
  }, []);

  // Timer — runs while the card is locked (and through the challenge).
  useEffect(() => {
    if (stage.kind !== 'locked') return;
    setTimeLeft(CHALLENGE_SECONDS);
    const iv = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 6 && t > 1) sfx.tick();
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [stage]);

  useEffect(() => {
    if (stage.kind === 'locked' && timeLeft <= 0) {
      sfx.timeout();
      recordLoss(true);
      setStage({ kind: 'escaped', card: stage.card, reason: 'timeout', correctAnswer: null });
    }
  }, [timeLeft, stage, recordLoss]);

  const answer = async (a: string) => {
    if (stage.kind !== 'locked') return;
    const result = await submitAnswer(stage.challenge, a);
    if (result.correct) {
      sfx.unlock();
      setStage({ kind: 'unlocking', card: stage.card, proof: result.proof ?? null });
    } else {
      sfx.wrong();
      recordLoss(false);
      setStage({ kind: 'escaped', card: stage.card, reason: 'wrong', correctAnswer: result.correctAnswer ?? null });
    }
  };

  // Claim after the unlock animation.
  useEffect(() => {
    if (stage.kind !== 'unlocking') return;
    const t = window.setTimeout(async () => {
      const card = stage.card;
      let onChain = false;

      // On-chain claim path — active once the contract is deployed and the
      // player has a real wallet connected on Robinhood Chain Testnet.
      if (stage.proof && isContractReady() && walletMode === 'injected' && walletAddress) {
        try {
          const txHash = await claimOnChain(card.number, stage.proof, walletAddress);
          onChain = true;
          push(`CLAIMED ON ROBINHOOD TESTNET · ${txHash.slice(0, 10)}…`, 'ok');
          push(`VIEW TX: ${claimTxExplorerUrl(txHash)}`, 'info');
        } catch (e) {
          push((e as Error).message === 'wallet_unavailable' ? 'WALLET UNAVAILABLE — LOCAL CLAIM' : 'TX FAILED — LOCAL CLAIM KEPT', 'warn');
        }
      } else if (walletAddress) {
        claimCardLocal(card, walletAddress); // future on-chain seam
      }

      const { isNew } = claimCard(card);
      recordWin();
      if (isNew) {
        sfx.win();
        push('NEW ROBOT!', 'ok');
        setStage({ kind: 'acquired', card, isNew: true, onChain });
      } else {
        sfx.duplicate();
        setStage({ kind: 'duplicate', card });
      }
    }, 1150);
    return () => window.clearTimeout(t);
  }, [stage, walletMode, walletAddress, claimCard, recordWin, push]);

  const burn = (card: RobotCardType) => {
    sfx.burn();
    burnDuplicate(card.id);
    push('+1 ROBOT SCRAP', 'warn');
    setStage({ kind: 'pack' });
  };

  const keep = () => {
    sfx.click();
    push('KEPT — +1 COPY', 'ok');
    setStage({ kind: 'pack' });
  };

  const restart = () => {
    sfx.click();
    startShuffle();
  };

  return (
    <div className="hunt">
      <AnimatePresence mode="wait">
        {stage.kind === 'pack' && (
          <motion.div
            key="pack"
            className="hunt-stage"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="hunt-stage-label">READY TO HUNT?</span>
            <div className="pack-wrap" onClick={startShuffle} role="button" aria-label="Open a card pack" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && startShuffle()}>
              <div className="pack-stack">
                <div className="pack-layer l0" />
                <div className="pack-layer l1" />
                <div className="pack-layer l2">
                  <span className="pack-robot-emoji" aria-hidden="true">
                    🤖
                  </span>
                  <span className="pack-badge">ROBOT HUNT</span>
                  <span className="pack-tap">TAP TO OPEN</span>
                </div>
              </div>
            </div>
            <p style={{ color: 'var(--body)', fontSize: 14, margin: 0 }}>
              One random robot. One human challenge. <strong style={{ color: 'var(--green)' }}>{TOTAL_CARDS} to collect.</strong>
            </p>
          </motion.div>
        )}

        {stage.kind === 'shuffling' && (
          <motion.div
            key="shuffling"
            className="shuffle-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.2 }}
          >
            <span className="hunt-stage-label">SCANNING ROBOTS…</span>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={shuffleIndex}
                className="shuffle-card"
                initial={{ opacity: 0.3, scale: 0.82, rotateY: 40 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 1.15 }}
                transition={{ duration: 0.12 }}
              >
                <img src={CARDS[shuffleIndex].image} alt="" />
              </motion.div>
            </AnimatePresence>
            <div className="shuffle-num">#{CARDS[shuffleIndex].id}</div>
          </motion.div>
        )}

        {stage.kind === 'locked' && (
          <motion.div
            key="locked"
            className="locked-wrap"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="hunt-stage-label">CARD FOUND</span>
            <div className="hunt-duo">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <RobotCard card={stage.card} locked size="showcase" />
                <h1 className="locked-title">
                  CARD <span className="warn">LOCKED</span>
                </h1>
                <p className="locked-sub">PROVE YOU'RE HUMAN TO CLAIM IT</p>
                <span className={`timer-pill${timeLeft <= 5 ? ' danger' : ''}`}>
                  <span className="ring" aria-hidden="true" />
                  {String(Math.max(0, timeLeft)).padStart(2, '0')}
                </span>
              </div>

              <div className="challenge-panel panel">
                <div className="challenge-head">
                  <span className="challenge-kicker">
                    ⚡ HUMAN CHECK · {stage.challenge.mode === 'server' ? 'SERVER' : 'LOCAL'}
                  </span>
                  <span className="challenge-cat">{CATEGORY_LABELS[stage.challenge.question.category]}</span>
                </div>
                <h2 className="challenge-q">{stage.challenge.question.text}</h2>
                <div className={`challenge-answers${stage.challenge.answers.length === 2 ? ' two' : ''}`}>
                  {stage.challenge.answers.map((a) => (
                    <button key={a} className="answer-btn" onClick={() => answer(a)}>
                      {a}
                    </button>
                  ))}
                </div>
                <div className="challenge-foot">
                  <span className="src">SRC · {stage.challenge.question.source}</span>
                  <span className="src">THE ROBOT IS WATCHING</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {stage.kind === 'unlocking' && (
          <motion.div key="unlocking" className="locked-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ParticleBurst count={56} flash origin={{ x: 50, y: 42 }} />
            <motion.div
              style={{ perspective: 900 }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 360 }}
              transition={{ duration: 1.05, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <RobotCard card={stage.card} size="showcase" />
            </motion.div>
            <div className="loading-line">
              VERIFYING HUMAN…
              <span className="loading-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          </motion.div>
        )}

        {stage.kind === 'acquired' && (
          <motion.div key="acquired" className="locked-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ParticleBurst count={70} flash origin={{ x: 50, y: 42 }} />
            <h1 className="result-title green">ROBOT ACQUIRED!</h1>
            <p className="result-sub">{stage.onChain ? '⛓ CLAIMED ON ROBINHOOD CHAIN TESTNET' : '+1 COLLECTION'}</p>
            <RobotCard card={stage.card} size="showcase" ownedCount={1} />
            {stage.card.rarity !== 'common' && (
              <span className={`rarity-banner ${stage.card.rarity}`}>
                {stage.card.rarity === 'legendary' ? '👑 LEGENDARY FIND' : `${stage.card.rarity.toUpperCase()} FIND!`}
              </span>
            )}
            <p className="result-sub">
              COLLECTION UPDATED ·{' '}
              <strong style={{ color: 'var(--green)' }}>
                {unique} / {TOTAL_CARDS}
              </strong>
            </p>
            <div className="result-actions">
              <button className="btn btn-primary btn-big" onClick={restart}>
                KEEP HUNTING
              </button>
              <button className="btn btn-big" onClick={() => navigate('collection')}>
                MY COLLECTION
              </button>
            </div>
          </motion.div>
        )}

        {stage.kind === 'duplicate' && (
          <motion.div key="duplicate" className="locked-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h1 className="result-title amber">DUPLICATE!</h1>
            <p className="result-sub">You already own this robot.</p>
            <RobotCard card={stage.card} size="showcase" />
            <div className="result-actions">
              <button className="btn btn-primary btn-big" onClick={keep}>
                KEEP
              </button>
              <button className="btn btn-danger btn-big" onClick={() => burn(stage.card)}>
                BURN · +1 SCRAP
              </button>
            </div>
            <p className="result-sub" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              Burning gives +1 ROBOT SCRAP — craft & reroll come later.
            </p>
          </motion.div>
        )}

        {stage.kind === 'escaped' && (
          <motion.div key="escaped" className="locked-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <FailureFlash />
            <h1 className={`result-title ${stage.reason === 'wrong' ? 'red' : 'amber'}`}>
              {stage.reason === 'wrong' ? 'WRONG!' : 'TOO SLOW'}
            </h1>
            <p className="result-sub">🤖 THE ROBOT ESCAPED!</p>
            <div style={{ position: 'relative', filter: 'saturate(0.35)' }}>
              <RobotCard card={stage.card} size="showcase" />
              <motion.div
                className="lock-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                style={{ background: 'rgba(10,12,14,0.55)' }}
              >
                <span className="lock-word" style={{ color: 'var(--danger)', fontSize: 12 }}>
                  ESCAPED
                </span>
              </motion.div>
            </div>
            {stage.correctAnswer && (
              <span className="result-reveal-answer">
                CORRECT ANSWER → <strong>{stage.correctAnswer}</strong>
              </span>
            )}
            <p className="result-sub">
              COLLECTION ·{' '}
              <strong style={{ color: 'var(--green)' }}>
                {unique} / {TOTAL_CARDS}
              </strong>
            </p>
            <div className="result-actions">
              <button className="btn btn-primary btn-big" onClick={restart}>
                TRY AGAIN
              </button>
              <button className="btn btn-big" onClick={() => navigate('collection')}>
                MY COLLECTION
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
