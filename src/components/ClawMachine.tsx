import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS, selectRandomCard } from '../data/cards';
import type { RobotCard } from '../data/types';
import { useToasts } from '../game/toasts';
import { sfx } from '../game/sounds';
import { ParticleBurst } from './Particles';

/**
 * Claw machine mini-game for the home page — pure fun, does NOT write to the
 * collection.
 *
 * Robots stand on a slowly moving conveyor bed (carried along with the belt)
 * like a real arcade prize machine. Move the claw, hold to grab, carry the
 * robot (it swings and slips on jerks) and release over the glowing pit.
 */

type Phase = 'idle' | 'descend' | 'grab' | 'lift' | 'carry' | 'cooldown';

interface ShelfRobot {
  card: RobotCard;
  /** fixed slot on the conveyor, as a fraction of one belt loop */
  beltFrac: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  falling: boolean;
  vanish: number; // 0..1 while being swallowed by the pit
  squash: number; // 0..1 landing squash animation
  fadeIn: number; // 0..1 entrance fade for replacement robots
}

const GRAVITY = 1500;
const ROPE_LEN = 90;
const SLIP_ANGLE = 1.15;
const GRAB_RADIUS = 64;
const MAX_SPEED = 460;
const ACCEL = 1600;
const BELT_SPEED = 26; // px/s — robots ride this conveyor
const ROBOT_SIZE = 160;
const BELT_MARGIN = 340;

const RARITY_COLOR: Record<string, string> = {
  common: '#9aa1a6',
  uncommon: '#5bd08a',
  rare: '#8b87d9',
  epic: '#e0b04e',
  legendary: '#ccff00',
};

export default function ClawMachine() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const push = useToasts((s) => s.push);

  const [hint, setHint] = useState('MOVE THE CLAW · HOLD TO GRAB A ROBOT');
  const [caught, setCaught] = useState(0);
  const [celebrate, setCelebrate] = useState(0);

  const robots = useMemo<ShelfRobot[]>(() => {
    const picks: RobotCard[] = [];
    const byRarity = (r: string) => CARDS.filter((c) => c.rarity === r);
    for (const r of ['legendary', 'epic', 'rare']) picks.push(...byRarity(r).slice(0, 2));
    picks.push(...byRarity('uncommon').slice(0, 1), ...byRarity('common').slice(0, 1));
    return picks.map((card, i) => ({
      card,
      beltFrac: i / picks.length,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      falling: false,
      vanish: 0,
      squash: 0,
      fadeIn: 0,
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
    const stageEl = scene.querySelector<HTMLElement>('.cm-stage')!;
    const flashEl = scene.querySelector<HTMLElement>('.cm-flash')!;

    const robotEls = new Map<number, { wrap: HTMLElement; img: HTMLImageElement }>();
    robots.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'cm-robot';
      const img = document.createElement('img');
      img.src = r.card.image.replace('/robots/', '/robots-cutout/');
      img.alt = r.card.name;
      img.draggable = false;
      wrap.appendChild(img);
      robotLayer.appendChild(wrap);
      robotEls.set(i, { wrap, img });
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
      beltY: rect.height * 0.84,
      boxX1: rect.width * 0.76,
      boxX2: rect.width * 0.94,
      beltLen: Math.max(800, rect.width * 0.76 - 60 + BELT_MARGIN),
    });
    const grabLen = () => geo().beltY - ROBOT_SIZE / 2 - (geo().railY + 10);
    const pitRange = (g: ReturnType<typeof geo>) => ({ x1: g.boxX1 + 8, x2: g.boxX2 - 8 });
    const overPit = (x: number, g: ReturnType<typeof geo>) => {
      const P = pitRange(g);
      return x >= P.x1 && x <= P.x2;
    };

    let beltScroll = 0;
    let clawPulse = 0;

    // ---- game feel: shake trauma, hit-stop, flash, gulp -------
    let trauma = 0;
    let freezeUntil = 0;
    let flashA = 0;
    let gulp = 0;
    let cableWobble = 0;
    const shake = (amt: number) => {
      trauma = Math.min(1, trauma + amt);
    };
    const freeze = (ms: number) => {
      freezeUntil = Math.max(freezeUntil, performance.now() + ms);
    };
    const poof = (x: number, y: number, color: string) => {
      for (let p = 0; p < 8; p++) {
        const el = document.createElement('span');
        el.className = 'cm-poof';
        const ang = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 46;
        el.style.cssText = `left:${x}px;top:${y}px;background:${color};--px:${Math.cos(ang) * dist}px;--py:${Math.sin(ang) * dist}px;--pr:${(Math.random() - 0.5) * 360}deg;`;
        scene.appendChild(el);
        window.setTimeout(() => el.remove(), 850);
      }
    };

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
    const restingX = (r: ShelfRobot) => {
      const L = geo().beltLen;
      return ((((r.beltFrac * L - beltScroll) % L) + L) % L) - BELT_MARGIN;
    };
    const rejoinBelt = (r: ShelfRobot) => {
      const L = geo().beltLen;
      r.beltFrac = ((((r.x + BELT_MARGIN + beltScroll) % L) + L) % L) / L;
      r.falling = false;
    };

    const replaceRobot = (idx: number) => {
      robots[idx] = {
        card: selectRandomCard(),
        beltFrac: 0.9 + Math.random() * 0.06,
        x: 0,
        y: geo().beltY - ROBOT_SIZE,
        vx: 0,
        vy: 0,
        falling: false,
        vanish: 0,
        squash: 0,
        fadeIn: 1,
      };
      const el = robotEls.get(idx);
      if (el) {
        el.img.src = robots[idx].card.image.replace('/robots/', '/robots-cutout/');
        el.img.alt = robots[idx].card.name;
      }
    };

    const spawnCoins = () => {
      const g = geo();
      const cx = (g.boxX1 + g.boxX2) / 2;
      const cy = g.beltY - 14;
      for (let i = 0; i < 14; i++) {
        const wrap = document.createElement('span');
        wrap.className = 'cm-coin';
        const ang = Math.random() * Math.PI;
        const dist = 70 + Math.random() * 95;
        const dirX = Math.random() < 0.5 ? -1 : 1;
        wrap.style.cssText = `left:${cx}px;top:${cy}px;--px:${(Math.cos(ang) * dist * dirX).toFixed(1)}px;--py:${(-40 - Math.sin(ang) * dist).toFixed(1)}px;`;
        const face = document.createElement('i');
        wrap.appendChild(face);
        scene.appendChild(wrap);
        window.setTimeout(() => wrap.remove(), 1100);
      }
    };

    const funCaught = (card: RobotCard) => {
      setCaught((n) => n + 1);
      setCelebrate((c) => c + 1);
      sfx.win();
      shake(0.5);
      freeze(95);
      flashA = 0.85;
      gulp = 1;
      spawnCoins();
      setHint('CAUGHT!');
      window.setTimeout(() => setHint('MOVE THE CLAW · HOLD TO GRAB A ROBOT'), 1800);
      push(`CAUGHT ${card.name} · #${card.id}`, 'ok');
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
      const inBox = overPit(payloadX, g);
      const r = robots[S.holdIdx];
      detach();
      if (inBox) {
        // Drops into the pit: falls, gets swallowed and vanishes with a
        // golden coin splash (handled by the pit-swallow path in tick).
        r.falling = true;
        r.x = payloadX;
        r.y = g.beltY - ROBOT_SIZE - 30;
        r.vx = S.omega * ROPE_LEN * Math.cos(S.theta) * 0.4;
        r.vy = 60;
        sfx.clawOpen();
        setHint('INTO THE PIT!');
      } else {
        r.falling = true;
        r.x = payloadX;
        r.y = g.beltY - ROBOT_SIZE - 20;
        r.vx = S.omega * ROPE_LEN * Math.cos(S.theta) * 0.7;
        r.vy = 60;
        sfx.clawSlip();
        setHint('IT BOUNCED BACK ON THE BELT');
        push('BOUNCED BACK ON THE BELT', 'warn');
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
        if (r.falling || r.vanish > 0) return;
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
        heldImg.style.filter = `drop-shadow(0 14px 18px rgba(0,0,0,0.7)) drop-shadow(0 0 24px ${RARITY_COLOR[robots[best].card.rarity] ?? 'rgba(91,208,138,0.6)'})`;
        heldEl.style.opacity = '1';
        clawPulse = 1;
        shake(0.16);
        freeze(50);
        poof(S.tx, geo().beltY - ROBOT_SIZE / 2, RARITY_COLOR[robots[best].card.rarity] ?? '#5bd08a');
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
    let lastVel = 0;
    let lastSign = 0;
    let reversal = 0; // 1 right after a direction change, decays over ~1.2s

    const tick = (now: number) => {
      const dtF = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now * 0.001;
      decayFeel(dtF);

      // Feel renders every frame — including during hit-stop — because shake,
      // flash and gulp are visual feedback, not simulation.
      const shakeAmt = trauma * trauma;
      stageEl.style.transform = `translate3d(${Math.sin(t * 47) * 9 * shakeAmt}px, ${Math.sin(t * 39) * 7 * shakeAmt}px, 0) rotate(${Math.sin(t * 31) * 0.5 * shakeAmt}deg)`;
      flashEl.style.opacity = String(Math.min(1, flashA));
      boxEl.style.transform = `scale(${1 + gulp * 0.1})`;

      // Hit-stop: freeze the simulation for impact.
      if (now < freezeUntil) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = dtF;
      const g = geo();
      const target = targetFor();
      beltScroll += BELT_SPEED * dt;
      clawPulse *= Math.pow(0.02, dt);

      // Motorized trolley — velocity ramps with bounded speed/acceleration.
      if (S.phase === 'idle' || S.phase === 'carry' || S.phase === 'cooldown') {
        const desired = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (target - S.tx) * 8));
        S.vel += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, desired - S.vel));
        S.tx += S.vel * dt;
      } else {
        S.vel = 0;
      }
      S.tx = Math.max(44, Math.min(g.W - 44, S.tx));
      const accel = (S.vel - lastVel) / Math.max(dt, 0.001);
      lastVel = S.vel;
      S.aSmooth += (accel - S.aSmooth) * 0.35;

      cableWobble *= Math.pow(0.015, dt);

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
          setHint(S.holdName ? `CARRYING ${S.holdName.toUpperCase()} — RELEASE OVER THE PIT` : 'MOVE THE CLAW · HOLD TO GRAB A ROBOT');
        }
      } else if (S.phase === 'lift') {
        S.cableLen += (46 - S.cableLen) * 0.16;
        if (S.cableLen < 62) {
          S.phase = 'carry';
          S.carryStart = now;
          cableWobble = 1;
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
        // Direction-change detector: the robot only loses grip when the
        // player reverses sharply while it is already swinging wide.
        const as = Math.sign(S.aSmooth);
        if (as !== 0) {
          if (lastSign !== 0 && as !== lastSign) reversal = 1;
          lastSign = as;
        }
        reversal = Math.max(0, reversal - dt * 0.8);
        const hardSwing = Math.abs(S.theta) > SLIP_ANGLE && Math.sign(S.theta) === Math.sign(S.omega);
        if (S.holdName && now > S.carryStart + 450 && hardSwing && reversal > 0 && Math.abs(S.aSmooth) > 1000) {
          sfx.clawSlip();
          shake(0.32);
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
      const cableSway = Math.max(-10, Math.min(10, S.vel * 0.3 + Math.sin(t * 34) * 7 * cableWobble));
      const cableLen = Math.max(20, S.cableLen);
      cableEl.style.height = `${cableLen}px`;
      cableEl.style.transform = `translate3d(${S.tx}px, ${trolleyY + 10}px, 0) rotate(${cableSway + (S.holdName ? S.theta * 24 : 0)}deg)`;

      const open = S.phase === 'idle' || S.phase === 'descend' || S.phase === 'grab';
      const pulse = 1 + clawPulse * 0.07;
      clawEl.style.transform = `translate3d(${S.tx}px, ${trolleyY + 10 + cableLen}px, 0) scale(${pulse})`;
      clawLeft.style.transform = `rotate(${open ? -36 : 0}deg)`;
      clawRight.style.transform = `rotate(${open ? 36 : 0}deg)`;

      if (S.holdName) {
        const px = S.tx + ROPE_LEN * Math.sin(S.theta);
        const py = trolleyY + 10 + cableLen + ROPE_LEN * Math.cos(S.theta);
        heldEl.style.transform = `translate3d(${px - ROBOT_SIZE / 2}px, ${py - ROBOT_SIZE / 2}px, 0) rotate(${S.theta * 40}deg)`;
        heldEl.style.opacity = '1';
        boxEl.classList.toggle('ready', overPit(px, g));
      } else {
        heldEl.style.opacity = '0';
        boxEl.classList.remove('ready');
      }

      // ---- conveyor robots ----
      robots.forEach((r, i) => {
        const el = robotEls.get(i);
        if (!el) return;
        const isHeld = i === S.holdIdx && S.holdName !== null;
        const alpha = r.fadeIn > 0 ? 1 - r.fadeIn : 1;
        el.wrap.style.opacity = isHeld ? '0' : String(alpha);

        if (r.falling) {
          r.vy += GRAVITY * 1.15 * dt;
          r.x += r.vx * dt;
          const ny = r.y + r.vy * dt;
          const overP = overPit(r.x, g);
          if (r.vanish > 0) {
            r.vanish += dt * 2.2;
            r.y += r.vy * dt;
            if (r.vanish >= 1) {
              const card = r.card;
              funCaught(card);
              replaceRobot(i);
              return;
            }
          } else if (overP && r.vy > 0 && ny > g.beltY - ROBOT_SIZE * 0.4) {
            // swallowed by the pit — no floor here, keep sinking and vanish
            r.vanish = Math.max(r.vanish, 0.001);
            r.y = ny;
          } else if (!overP && ny >= g.beltY - ROBOT_SIZE) {
            r.y = g.beltY - ROBOT_SIZE;
            if (r.vy > 90) {
              sfx.clawThud();
              shake(0.1);
              r.squash = 1;
              r.vy = -r.vy * 0.35;
              r.vx *= 0.55;
            } else {
              r.vy = 0;
              r.vx = 0;
              r.falling = false;
              rejoinBelt(r);
            }
          } else {
            r.y = ny;
          }
        } else {
          r.y = g.beltY - ROBOT_SIZE;
          r.x = restingX(r);
          if (r.fadeIn > 0) r.fadeIn = Math.max(0, r.fadeIn - dt * 2.5);
        }

        r.squash *= Math.pow(0.002, dt);
        const sx = 1 + r.squash * 0.22;
        const sy = 1 - r.squash * 0.26;
        const vScale = r.vanish > 0 ? Math.max(0, 1 - r.vanish * 0.9) : 1;
        el.img.style.transform = `scale(${sx}, ${sy})`;
        el.img.style.opacity = r.vanish > 0 ? String(Math.max(0, 1 - r.vanish)) : '1';
        el.wrap.style.transform = `translate3d(${r.x - ROBOT_SIZE / 2}px, ${r.y}px, 0) scale(${vScale})`;
      });

      raf = requestAnimationFrame(tick);
    };

    if (!reduced) raf = requestAnimationFrame(tick);

    const decayFeel = (dtF: number) => {
      trauma = Math.max(0, trauma - dtF * 1.3);
      flashA *= Math.pow(0.001, dtF);
      gulp *= Math.pow(0.001, dtF);
    };

    return () => {
      cancelAnimationFrame(raf);
      robotEls.forEach((el) => el.wrap.remove());
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
  }, [robots, push]);

  return (
    <div className="cm-scene" ref={sceneRef} aria-label="Robot claw mini-game — move the claw, grab a robot and drop it into the pit. For fun only.">
      <div className="cm-stage">
        <div className="cm-marquee">
          <span className="cm-marquee-title">🤖 CLAW MINI-GAME</span>
          <span className="cm-marquee-lights" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ ['--ld' as string]: `${-(i * 1.7)}s`, ['--ldur' as string]: `${7 + (i % 5)}s` }} />
            ))}
          </span>
        </div>

        <div className="cm-rail" aria-hidden="true" />
        <div className="cm-trolley" aria-hidden="true">
          <span className="cm-wheel cm-wheel-l" />
          <span className="cm-wheel cm-wheel-r" />
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

        <div className="cm-belt" aria-hidden="true">
          <span className="cm-belt-dashes" />
          <span className="cm-belt-rollers" />
          <span className="cm-belt-edge" />
        </div>

        <div className="cm-box" aria-hidden="true">
          <span className="cm-box-label">FUN PIT</span>
          <span className="cm-box-arrow">▼</span>
        </div>

        <div className="cm-spot cm-spot-l" aria-hidden="true">
          <span className="cm-dust" />
          <span className="cm-dust d2" />
          <span className="cm-dust d3" />
        </div>
        <div className="cm-spot cm-spot-r" aria-hidden="true">
          <span className="cm-dust" />
          <span className="cm-dust d2" />
          <span className="cm-dust d3" />
        </div>

        <div className="cm-cab" aria-hidden="true">
          <span className="cm-cab-back" />
          <span className="cm-cab-side cm-cab-side-l" />
          <span className="cm-cab-side cm-cab-side-r" />
          <span className="cm-cab-glass" />
          <span className="cm-cab-frame" />
        </div>

        <div className="cm-flash" aria-hidden="true" />

        <div className="cm-hud">
          <span className="cm-hud-count" key={caught}>
            CAUGHT {caught}
          </span>
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
