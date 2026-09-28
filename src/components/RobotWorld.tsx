import { useEffect, useMemo, useRef } from 'react';
import { CARDS } from '../data/cards';
import type { Rarity, RobotCard } from '../data/types';

/**
 * 10 real robots from the collection walking through a pseudo-3D scene.
 * Pure 2D DOM/CSS: a perspective floor, layered platforms, lighting, fog,
 * particles and depth-banded sprites driven by a single rAF loop.
 */

const PICK_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

interface Sprite {
  card: RobotCard;
  band: 0 | 1 | 2;
  y: number;
  scale: number;
  speed: number; // scene-width % per second
  dir: 1 | -1;
  x: number; // scene-width %
  bobFreq: number;
  bobAmp: number;
  bobPhase: number;
  tilt: number;
  blur: number;
  z: number;
  idleUntil: number; // performance.now() timestamp, 0 = walking
}

const BANDS = [
  { y: 92, scale: 0.6, z: 4, blur: 0.9, speedMul: 0.5 },
  { y: 148, scale: 0.82, z: 14, blur: 0.35, speedMul: 0.75 },
  { y: 206, scale: 1.1, z: 26, blur: 0, speedMul: 1.1 },
];

function makeSprites(): Sprite[] {
  const picks: RobotCard[] = PICK_ORDER.flatMap((r) => CARDS.filter((c) => c.rarity === r).slice(0, 2));
  return picks.map((card, i) => {
    const band = (i % 3) as 0 | 1 | 2;
    const b = BANDS[band];
    const r = (n: number) => Math.abs(Math.sin(i * 9301 + n * 49297)) * 233280 % 1;
    return {
      card,
      band,
      y: b.y + Math.round((i % 2 === 0 ? 4 : -6)),
      scale: b.scale,
      speed: 5 + r(1) * 9 * b.speedMul,
      dir: i % 2 === 0 ? 1 : -1,
      x: 6 + ((i * 9.4) % 82),
      bobFreq: 4.5 + r(2) * 3.5,
      bobAmp: 2.4 + r(3) * 3,
      bobPhase: r(4) * Math.PI * 2,
      tilt: (r(5) - 0.5) * 4,
      blur: b.blur,
      z: b.z + (i % 3),
      idleUntil: 0,
    };
  });
}

const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 41.3 + 7) % 96}%`,
  top: `${(i * 29.7 + 5) % 88}%`,
  delay: `${(i % 8) * 0.9}s`,
  cls: i % 3 === 0 ? ' iris' : i % 3 === 1 ? ' amber' : '',
}));

export default function RobotWorld() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const sprites = useMemo(makeSprites, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const wraps: (HTMLElement | null)[] = [];
    const robots: (HTMLElement | null)[] = [];
    const shadows: (HTMLElement | null)[] = [];
    sprites.forEach((_, i) => {
      wraps.push(scene.querySelector(`[data-sprite="${i}"]`));
      robots.push(scene.querySelector(`[data-robot="${i}"]`));
      shadows.push(scene.querySelector(`[data-shadow="${i}"]`));
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sprites.forEach((s, i) => {
        const w = wraps[i];
        if (w) w.style.transform = `translate3d(${(s.x / 100) * scene.clientWidth}px, ${s.y}px, 0)`;
      });
      return;
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const width = scene.clientWidth;
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        const wrap = wraps[i];
        const img = robots[i];
        const sh = shadows[i];
        if (!wrap || !img || !sh) continue;

        if (s.idleUntil) {
          if (now > s.idleUntil) {
            s.idleUntil = 0;
            if (Math.random() < 0.4) s.dir = (s.dir * -1) as 1 | -1;
          }
        } else {
          s.x += s.dir * s.speed * dt;
          if (s.x > 116) {
            s.x = 116;
            s.dir = -1;
          } else if (s.x < -16) {
            s.x = -16;
            s.dir = 1;
          }
          if (Math.random() < dt * 0.14) s.idleUntil = now + 800 + Math.random() * 1900;
        }

        const t = now * 0.001;
        const bob = s.idleUntil ? 0 : Math.sin(t * s.bobFreq + s.bobPhase) * s.bobAmp;
        const sway = s.idleUntil ? 0 : Math.sin(t * s.bobFreq * 2 + s.bobPhase) * 1.1;
        wrap.style.transform = `translate3d(${(s.x / 100) * width}px, ${s.y}px, 0)`;
        img.style.transform = `scale(${s.dir * s.scale}, ${s.scale}) translateY(${bob}px) rotate(${s.tilt + sway}deg)`;
        sh.style.opacity = String(0.3 + s.band * 0.12);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sprites]);

  return (
    <div className="rw-scene" ref={sceneRef} aria-hidden="true">
      <div className="rw-sky" />
      <div className="rw-glow rw-glow-a" />
      <div className="rw-glow rw-glow-b" />
      <div className="rw-grid" />
      <div className="rw-platform rw-platform-back" />
      <div className="rw-platform rw-platform-front" />
      {sprites.map((s, i) => (
        <div
          key={i}
          className="rw-sprite"
          data-sprite={i}
          style={{ zIndex: s.z, transform: `translate3d(${s.x}px, ${s.y}px, 0)` }}
        >
          <img
            className="rw-robot"
            data-robot={i}
            src={s.card.image}
            alt=""
            loading="lazy"
            draggable={false}
            style={{
              transform: `scale(${s.dir * s.scale}, ${s.scale})`,
              filter: s.blur ? `blur(${s.blur}px) brightness(0.92)` : undefined,
            }}
          />
          <span className="rw-shadow" data-shadow={i} style={{ transform: `scale(${s.scale}, 1)`, opacity: 0.3 + s.band * 0.12 }} />
        </div>
      ))}
      <div className="rw-sparkles">
        {SPARKLES.map((p, i) => (
          <span key={i} className={`bg-sparkle${p.cls}`} style={{ left: p.left, top: p.top, animationDelay: p.delay }} />
        ))}
      </div>
      <div className="rw-fog" />
      <div className="rw-vignette" />
    </div>
  );
}
