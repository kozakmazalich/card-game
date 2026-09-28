import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS, selectRandomCard } from '../data/cards';
import type { RobotCard } from '../data/types';
import { useGame } from '../game/store';
import { useToasts } from '../game/toasts';
import { sfx } from '../game/sounds';
import { ParticleBurst } from './Particles';

/**
 * Premium arcade claw machine.
 *
 * Move the claw over a robot, hold to grab it, carry it (it swings and can
 * slip if you move too fast), and release above the glowing collection box.
 * A successful drop claims the robot for your collection.
 *
 * Controls: mouse move = aim · click & hold = grab + carry · release = drop.
 * Arrow keys move the claw, Space/Enter grab and release. On touch, drag to
 * aim and use the GRAB / RELEASE button.
 */

type Phase = 'idle' | 'descend' | 'grab' | 'lift' | 'carry' | 'cooldown';

interface ShelfRobot {
  card: RobotCard;
  /** resting slot, 0..1 across the shelf */
  slotFrac: number;
  /** world position while falling/resting */
  x: number;
  y: number;
  vx: number;
  vy: number;
  falling: boolean;
}

const GRAVITY = 1500;
const ROPE_LEN = 64;
const SLIP_ANGLE = 1.15;
const GRAB_RADIUS = 42;
const MAX_SPEED = 460; // trolley px/s — a real motor, not a mouse cursor
const ACCEL = 1600; // trolley px/s^2
const ROBOT_SIZE = 84;

export default function ClawMachine() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const claimCard = useGame((s) => s.claimCard);
  const push = useToasts((s) => s.push);

  const [hint, setHint] = useState('MOVE THE CLAW · HOLD TO GRAB A ROBOT');
  const [sessionCount, setSessionCount] = useState(0);
  const [celebrate, setCelebrate] = useState(0);

  const robots = useMemo<ShelfRobot[]>(() => {
    const picks: RobotCard[] = [];
    const byRarity = (r: string) => CARDS.filter((c) => c.rarity === r);
    for (const r of ['legendary', 'epic', 'rare', 'uncommon', 'common']) picks.push(...byRarity(r).slice(0, 2));
    return picks.map((card, i) => ({
      card,
      slotFrac: i / (picks.length - 1),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      falling: false,
    }));
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const trolleyEl = scene.querySelector<HTMLElement>('.cm-trolley')!;
    const cableEl = scene.querySelector<HTMLElement>('.cm-cable')!;
    const clawEl = scene.querySelector<HTMLElement>('.cm-claw')!;
    const clawLeft = clawEl.querySelector<HTMLElement>('.cm-prong-l')!;
    const clawRight = clawEl.querySelector<HTMLElement>('.cm-prong-r')!;
    const heldEl = scene.querySelector<HTMLElement>('.cm-held')!;
    const heldImg = scene.querySelector<HTMLImageElement>('.cm-held img')!;
    const boxEl = scene.querySelector<HTMLElement>('.cm-box')!;
    const robotLayer = scene.querySelector<HTMLElement>('.cm-robots')!;
    const grabBtn = scene.querySelector<HTMLElement>('.cm-grab-btn')!;

    const robotEls = new Map<number, HTMLElement>();
    robots.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'cm-robot';
      const img = document.createElement('img');
      img.src = r.card.image.replace('/robots/', '/robots-cutout/');
      img.alt = r.card.name;
      img.draggable = false;
      wrap.appendChild(img);
      robotLayer.appendChild(wrap);
      robotEls.set(i, wrap);
    });

    let rect = scene.getBoundingClientRect();
    const updateRect = () => {
      rect = scene.getBoundingClientRect();
    };
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });

    const geo = () => ({
      W: rect.width,
      H: rect.height,
      railY: rect.height * 0.16,
      shelfY: rect.height * 0.84,
      boxX1: rect.width * 0.76,
      boxX2: rect.width * 0.94,
    });
    const grabLen = () => geo().shelfY - 58 - (geo().railY + 10);

    const S = {
      phase: 'idle' as Phase,
      tx: rect.width * 0.35,
      targetX: rect.width * 0.35,
      kbX: rect.width * 0.35,
      keyboard: false,
      vel: 0,
      aSmooth: 0,
      cableLen: 36,
      theta: 0,
      omega: 0,
      holdIdx: -1,
      holdName: null as string | null,
      grabUntil: 0,
      cooldownUntil: 0,
      carryStart: 0,
    };

    const targetFor = () => (S.keyboard ? S.kbX : S.targetX);
    const restingX = (r: ShelfRobot) => geo().W * (0.06 + 0.62 * r.slotFrac);

    const replaceRobot = (idx: number, atX: number) => {
      robots[idx] = {
        card: selectRandomCard(),
        slotFrac: robots[idx].slotFrac,
        x: atX,
        y: geo().shelfY - 300,
        vx: 0,
        vy: 0,
        falling: true,
      };
      const el = robotEls.get(idx);
      if (el) {
        const img = el.querySelector('img')!;
        img.src = robots[idx].card.image.replace('/robots/', '/robots-cutout/');
        img.alt = robots[idx].card.name;
      }
    };

    const celebrateCollect = (card: RobotCard) => {
      const { isNew } = claimCard(card);
      setSessionCount((n) => n + 1);
      setCelebrate((c) => c + 1);
      sfx.win();
      if (isNew) push(`NEW ROBOT · ${card.name}`, 'ok');
      else push(`DUPLICATE · +1 COPY OF ${card.name}`, 'warn');
    };

    const detach = () => {
      heldEl.style.opacity = '0';
      heldImg.removeAttribute('src');
      S.holdIdx = -1;
      S.holdName = null;
      S.theta = 0;
      S.omega = 0;
    };

    const releasePayload = () => {
      if (!S.holdName || S.holdIdx < 0) return;
      const tipX = S.tx;
      const payloadX = tipX + ROPE_LEN * Math.sin(S.theta);
      const g = geo();
      const inBox = payloadX >= g.boxX1 + 14 && payloadX <= g.boxX2 - 14;
      if (inBox) {
        const idx = S.holdIdx;
        const r = robots[idx];
        detach();
        celebrateCollect(r.card);
        replaceRobot(idx, payloadX);
        setHint('ROBOT ACQUIRED!');
        window.setTimeout(() => setHint('MOVE THE CLAW · HOLD TO GRAB A ROBOT'), 2200);
      } else {
        const r = robots[S.holdIdx];
        r.falling = true;
        r.x = payloadX;
        r.y = geo().shelfY - ROBOT_SIZE;
        r.vx = S.omega * ROPE_LEN * Math.cos(S.theta) * 0.7;
        r.vy = 60;
        sfx.clawSlip();
        setHint('MISSED THE BOX — GRAB IT AGAIN');
        push('MISSED THE BOX', 'warn');
        detach();
      }
    };

    const beginGrab = () => {
      if (S.phase !== 'idle') return;
      S.tx = Math.max(44, Math.min(geo().W - 44, targetFor()));
      S.keyboard = false;
      sfx.clawDescend();
      S.phase = 'descend';
      setHint('LOWERING CLAW…');
    };

    const grabRobot = () => {
      let best = -1;
      let bestD = GRAB_RADIUS;
      robots.forEach((r, i) => {
        if (r.falling) return;
        const d = Math.abs(restingX(r) - S.tx);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        S.holdIdx = best;
        S.holdName = robots[best].card.name;
        heldImg.src = robots[best].card.image.replace('/robots/', '/robots-cutout/');
        heldImg.alt = robots[best].card.name;
        heldEl.style.opacity = '1';
      } else {
        S.holdIdx = -1;
        S.holdName = null;
        heldEl.style.opacity = '0';
      }
      sfx.clawOpen();
    };

    const doRelease = () => {
      if (S.phase === 'carry') {
        if (S.holdName) releasePayload();
        S.theta = 0;
        S.omega = 0;
        S.phase = 'cooldown';
        S.cooldownUntil = performance.now() + 700;
        if (!S.holdName) setHint('MOVE THE CLAW · HOLD TO GRAB A ROBOT');
      }
    };

    // ---- input ----
    const onMove = (e: PointerEvent) => {
      S.keyboard = false;
      S.targetX = Math.max(44, Math.min(rect.width - 44, e.clientX - rect.left));
      if (S.phase === 'idle' || S.phase === 'cooldown') S.tx = S.targetX;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      onMove(e);
      beginGrab();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      doRelease();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        S.keyboard = true;
        S.kbX = Math.max(44, targetFor() - 28);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        S.keyboard = true;
        S.kbX = Math.min(rect.width - 44, targetFor() + 28);
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat && S.phase === 'idle') beginGrab();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') doRelease();
    };

    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    grabBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (S.phase === 'carry') doRelease();
      else beginGrab();
    });
    grabBtn.addEventListener('click', (e) => e.stopPropagation());

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = performance.now();
    let lastVx = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = geo();
      const target = targetFor();

      // Motorized trolley: velocity ramps toward the aim point with bounded
      // speed and acceleration — so jerks are real player input, not math noise.
      if (S.phase === 'idle' || S.phase === 'carry' || S.phase === 'cooldown') {
        const desired = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (target - S.tx) * 8));
        S.vel += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, desired - S.vel));
        S.tx += S.vel * dt;
      } else {
        S.vel = 0;
      }
      S.tx = Math.max(44, Math.min(geo().W - 44, S.tx));
      const accel = (S.vel - lastVx) / Math.max(dt, 0.001);
      lastVx = S.vel;
      S.aSmooth += (accel - S.aSmooth) * 0.35;

      // phase machine
      if (S.phase === 'descend') {
        S.cableLen += (grabLen() - S.cableLen) * 0.14;
        if (Math.abs(grabLen() - S.cableLen) < 6) {
          S.phase = 'grab';
          S.grabUntil = now + 240;
          grabRobot();
        }
      } else if (S.phase === 'grab') {
        if (now > S.grabUntil) {
          S.phase = 'lift';
          sfx.clawAscend();
          setHint(S.holdName ? `CARRYING ${S.holdName.toUpperCase()} — RELEASE OVER THE BOX` : 'MOVE THE CLAW · HOLD TO GRAB A ROBOT');
        }
      } else if (S.phase === 'lift') {
        S.cableLen += (46 - S.cableLen) * 0.16;
        if (S.cableLen < 62) {
          S.phase = 'carry';
          S.carryStart = now;
        }
      } else if (S.phase === 'cooldown') {
        S.cableLen += (36 - S.cableLen) * 0.12;
        if (now > S.cooldownUntil && S.cableLen < 50) {
          S.phase = 'idle';
          setHint('MOVE THE CLAW · HOLD TO GRAB A ROBOT');
        }
      } else if (S.phase === 'carry') {
        S.cableLen = 46;
        S.omega += (-(GRAVITY / ROPE_LEN) * Math.sin(S.theta) - 0.55 * S.omega + (S.aSmooth / ROPE_LEN) * Math.cos(S.theta)) * dt;
        S.theta += S.omega * dt;
        // Slip only on a jerk WHILE the robot is already swinging hard —
        // sharp direction changes lose the robot, smooth wide swings don't.
        const hardSwing = Math.abs(S.theta) > SLIP_ANGLE && Math.sign(S.theta) === Math.sign(S.omega);
        const jerking = Math.abs(S.aSmooth) > 1300;
        if (S.holdName && now > S.carryStart + 450 && hardSwing && jerking) {
          sfx.clawSlip();
          push('TOO FAST! THE ROBOT SLIPPED', 'warn');
          setHint('TOO FAST! THE ROBOT SLIPPED');
          releasePayload();
          S.phase = 'cooldown';
          S.cooldownUntil = now + 900;
        }
      } else if (S.phase === 'idle') {
        S.cableLen = 36;
      }

      // ---- render claw rig ----
      const trolleyY = g.railY;
      trolleyEl.style.transform = `translate3d(${S.tx}px, 0, 0)`;
      const cableSway = Math.max(-10, Math.min(10, S.vel * 0.3));
      const cableLen = Math.max(20, S.cableLen);
      cableEl.style.height = `${cableLen}px`;
      cableEl.style.transform = `translate3d(${S.tx}px, ${trolleyY + 10}px, 0) rotate(${cableSway + (S.holdName ? S.theta * 24 : 0)}deg)`;

      const open = S.phase === 'idle' || S.phase === 'descend' || S.phase === 'grab';
      clawEl.style.transform = `translate3d(${S.tx}px, ${trolleyY + 10 + cableLen}px, 0)`;
      clawLeft.style.transform = `rotate(${open ? -36 : 0}deg)`;
      clawRight.style.transform = `rotate(${open ? 36 : 0}deg)`;

      // held robot hangs below the claw with pendulum offset
      if (S.holdName) {
        const px = S.tx + ROPE_LEN * Math.sin(S.theta);
        const py = trolleyY + 10 + cableLen + ROPE_LEN * Math.cos(S.theta);
        heldEl.style.transform = `translate3d(${px - ROBOT_SIZE / 2}px, ${py - ROBOT_SIZE / 2}px, 0) rotate(${S.theta * 40}deg)`;
        heldEl.style.opacity = '1';
        boxEl.classList.toggle('ready', px >= g.boxX1 && px <= g.boxX2);
      } else {
        heldEl.style.opacity = '0';
        boxEl.classList.remove('ready');
      }

      // ---- shelf robots ----
      robots.forEach((r, i) => {
        const el = robotEls.get(i);
        if (!el) return;
        const isHeld = i === S.holdIdx && S.holdName !== null;
        el.style.opacity = isHeld ? '0' : '1';

        if (r.falling) {
          r.vy += GRAVITY * 1.15 * dt;
          r.x += r.vx * dt;
          const ny = r.y + r.vy * dt;
          // fell into the collection pit
          if (r.vy > 0 && r.x >= g.boxX1 + 10 && r.x <= g.boxX2 - 10 && ny > g.shelfY - 40) {
            const card = r.card;
            celebrateCollect(card);
            replaceRobot(i, r.x);
            return;
          }
          if (ny >= g.shelfY - ROBOT_SIZE) {
            r.y = g.shelfY - ROBOT_SIZE;
            if (r.vy > 90) {
              sfx.clawThud();
              r.vy = -r.vy * 0.35;
              r.vx *= 0.55;
            } else {
              r.vy = 0;
              r.vx = 0;
              r.falling = false;
            }
          } else {
            r.y = ny;
          }
        } else {
          r.y = g.shelfY - ROBOT_SIZE;
          r.x = restingX(r);
        }
        el.style.transform = `translate3d(${r.x - ROBOT_SIZE / 2}px, ${r.y}px, 0)`;
      });

      raf = requestAnimationFrame(tick);
    };

    if (!reduced) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      robotEls.forEach((el) => el.remove());
      robotEls.clear();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      scene.removeEventListener('pointermove', onMove);
      scene.removeEventListener('pointerdown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robots, claimCard, push]);

  return (
    <div className="cm-scene" ref={sceneRef} aria-label="Robot claw machine — move the claw, grab a robot and drop it into the collection box.">
      <div className="cm-stage">
        <div className="cm-marquee">
          <span className="cm-marquee-title">🤖 ROBOT HUNT · CLAW</span>
          <span className="cm-marquee-lights" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ ['--ld' as string]: `${-(i * 1.7)}s`, ['--ldur' as string]: `${7 + (i % 5)}s` }} />
            ))}
          </span>
        </div>

        <div className="cm-rail" aria-hidden="true" />
        <div className="cm-trolley" aria-hidden="true">
          <span className="cm-trolley-eye" />
        </div>
        <div className="cm-cable" aria-hidden="true" />
        <div className="cm-claw" aria-hidden="true">
          <span className="cm-claw-hub" />
          <span className="cm-prong cm-prong-l" />
          <span className="cm-prong cm-prong-r" />
          <span className="cm-prong cm-prong-m" />
        </div>
        <div className="cm-held" aria-hidden="true">
          <img alt="" />
        </div>

        <div className="cm-robots" aria-hidden="true" />

        <div className="cm-shelf" aria-hidden="true" />

        <div className="cm-box" aria-hidden="true">
          <span className="cm-box-label">COLLECTION</span>
          <span className="cm-box-arrow">▼</span>
        </div>

        <div className="cm-spot cm-spot-l" aria-hidden="true" />
        <div className="cm-spot cm-spot-r" aria-hidden="true" />

        <div className="cm-glass" aria-hidden="true" />

        <div className="cm-hud">
          <span className="cm-hud-count">COLLECTED {sessionCount}</span>
          <span className="cm-hint">{hint}</span>
          <button className="cm-grab-btn" type="button">
            🖐 GRAB / RELEASE
          </button>
        </div>
      </div>
      {celebrate > 0 && <ParticleBurst key={celebrate} count={46} flash origin={{ x: 86, y: 62 }} />}
    </div>
  );
}
