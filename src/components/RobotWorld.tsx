import { useEffect, useMemo, useRef } from 'react';
import { CARDS } from '../data/cards';
import type { Rarity, RobotCard } from '../data/types';
import { sfx } from '../game/sounds';

/**
 * 10 real robots from the collection walking through a pseudo-3D world.
 * Pure 2D DOM/CSS: perspective floor, platforms, lighting, fog, particles,
 * depth-banded sprites, camera parallax — driven by a single rAF loop.
 *
 * Robots are interactive: hover lifts them, and clicking one makes it chase
 * the cursor across the whole page until clicked again.
 */

const PICK_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa1a6',
  uncommon: '#5bd08a',
  rare: '#8b87d9',
  epic: '#e0b04e',
  legendary: '#ccff00',
};

interface Sprite {
  card: RobotCard;
  band: 0 | 1 | 2;
  y: number;
  scale: number;
  speed: number;
  dir: 1 | -1;
  x: number; // scene-width %
  bobFreq: number;
  bobAmp: number;
  bobPhase: number;
  tilt: number;
  blur: number;
  z: number;
  idleUntil: number;
  following: boolean;
  fx: number;
  fy: number;
  hover: boolean;
}

const BANDS = [
  { y: 118, scale: 0.68, z: 4, blur: 0.6, speedMul: 0.5 },
  { y: 200, scale: 0.95, z: 14, blur: 0, speedMul: 0.78 },
  { y: 272, scale: 1.32, z: 26, blur: 0, speedMul: 1.1 },
];

function makeSprites(): Sprite[] {
  const picks: RobotCard[] = PICK_ORDER.flatMap((r) => CARDS.filter((c) => c.rarity === r).slice(0, 2));
  return picks.map((card, i) => {
    const band = (i % 3) as 0 | 1 | 2;
    const b = BANDS[band];
    const r = (n: number) => (Math.abs(Math.sin(i * 9301 + n * 49297)) * 233280) % 1;
    return {
      card,
      band,
      y: b.y + (i % 2 === 0 ? 6 : -8),
      scale: b.scale,
      speed: 5 + r(1) * 9 * b.speedMul,
      dir: i % 2 === 0 ? 1 : -1,
      x: 4 + ((i * 9.4) % 88),
      bobFreq: 4.5 + r(2) * 3.5,
      bobAmp: 2.6 + r(3) * 3.2,
      bobPhase: r(4) * Math.PI * 2,
      tilt: (r(5) - 0.5) * 4,
      blur: b.blur,
      z: b.z + (i % 3),
      idleUntil: 0,
      following: false,
      fx: 0,
      fy: 0,
      hover: false,
    };
  });
}

const SPARKLES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 41.3 + 7) % 96}%`,
  top: `${(i * 29.7 + 5) % 90}%`,
  delay: `${(i % 8) * 0.9}s`,
  cls: i % 3 === 0 ? ' iris' : i % 3 === 1 ? ' amber' : '',
}));

export default function RobotWorld() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const sprites = useMemo(makeSprites, []);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const wraps: (HTMLElement | null)[] = [];
    const robots: (HTMLElement | null)[] = [];
    const shadows: (HTMLElement | null)[] = [];
    const auras: (HTMLElement | null)[] = [];
    const tags: (HTMLElement | null)[] = [];
    sprites.forEach((_, i) => {
      wraps.push(scene.querySelector(`[data-sprite="${i}"]`));
      robots.push(scene.querySelector(`[data-robot="${i}"]`));
      shadows.push(scene.querySelector(`[data-shadow="${i}"]`));
      auras.push(scene.querySelector(`[data-aura="${i}"]`));
      tags.push(scene.querySelector(`[data-tag="${i}"]`));
    });

    const sky = scene.querySelector<HTMLElement>('.rw-sky');
    const grid = scene.querySelector<HTMLElement>('.rw-grid');
    const glowA = scene.querySelector<HTMLElement>('.rw-glow-a');
    const glowB = scene.querySelector<HTMLElement>('.rw-glow-b');

    let rect = scene.getBoundingClientRect();
    const updateRect = () => {
      rect = scene.getBoundingClientRect();
    };
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });

    const onMove = (e: PointerEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const release = (s: Sprite, wrap: HTMLElement | null) => {
      const xPct = Math.min(112, Math.max(-12, ((s.fx - rect.left) / Math.max(1, rect.width)) * 100));
      s.x = xPct;
      s.y = Math.min(rect.height - 20, Math.max(-90, s.fy - rect.top));
      s.following = false;
      if (wrap) {
        wrap.style.position = 'absolute';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        wrap.style.zIndex = String(s.z);
        wrap.classList.remove('following');
      }
      sfx.click();
    };

    const toggleFollow = (s: Sprite, wrap: HTMLElement | null) => {
      if (s.following) {
        release(s, wrap);
        return;
      }
      sprites.forEach((other, j) => {
        if (other.following) release(other, wraps[j]);
      });
      s.following = true;
      s.fx = mouse.current.x;
      s.fy = mouse.current.y;
      if (wrap) {
        wrap.style.position = 'fixed';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        wrap.style.zIndex = '900';
        wrap.classList.add('following');
      }
      sfx.hover();
    };

    const handlers: { el: HTMLElement | null; enter: () => void; leave: () => void; click: (e: Event) => void }[] = [];
    sprites.forEach((s, i) => {
      const wrap = wraps[i];
      if (!wrap) return;
      const enter = () => {
        s.hover = true;
        wrap.classList.add('hovered');
      };
      const leave = () => {
        s.hover = false;
        wrap.classList.remove('hovered');
      };
      const click = (e: Event) => {
        e.stopPropagation();
        toggleFollow(s, wrap);
      };
      wrap.addEventListener('pointerenter', enter);
      wrap.addEventListener('pointerleave', leave);
      wrap.addEventListener('click', click);
      handlers.push({ el: wrap, enter, leave, click });
    });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      sprites.forEach((s, i) => {
        wraps[i]!.style.transform = `translate3d(${(s.x / 100) * rect.width}px, ${s.y}px, 0)`;
      });
      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
        window.removeEventListener('pointermove', onMove);
        handlers.forEach((h) => {
          if (h.el) {
            h.el.removeEventListener('pointerenter', h.enter);
            h.el.removeEventListener('pointerleave', h.leave);
            h.el.removeEventListener('click', h.click);
          }
        });
      };
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now * 0.001;

      // Camera parallax from the cursor.
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const px = mouse.current.x === -9999 ? 0 : (mouse.current.x - cx) / Math.max(1, rect.width);
      const py = mouse.current.x === -9999 ? 0 : (mouse.current.y - cy) / Math.max(1, rect.height);
      if (sky) sky.style.transform = `translate3d(${px * 10}px, ${py * 6}px, 0)`;
      if (grid) grid.style.transform = `translate3d(${px * -18}px, 0, 0) rotateX(64deg)`;
      if (glowA) glowA.style.transform = `translate3d(${px * 26}px, ${py * 16}px, 0)`;
      if (glowB) glowB.style.transform = `translate3d(${px * -20}px, ${py * -12}px, 0)`;

      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        const wrap = wraps[i];
        const img = robots[i];
        const sh = shadows[i];
        const aura = auras[i];
        const tag = tags[i];
        if (!wrap || !img || !sh || !aura || !tag) continue;

        if (s.following) {
          // Chase the cursor with soft easing + banking into turns.
          const k = 0.15;
          const vx = (mouse.current.x - s.fx) * k;
          const vy = (mouse.current.y - s.fy) * k;
          s.fx += vx;
          s.fy += vy;
          const bank = Math.max(-16, Math.min(16, vx * 1.6));
          const bob = Math.sin(t * 9 + s.bobPhase) * 5;
          wrap.style.transform = `translate3d(${s.fx - 75}px, ${s.fy - 150}px, 0)`;
          img.style.transform = `scale(${s.dir * 1.55}, 1.55) translateY(${bob}px) rotate(${bank}deg)`;
          sh.style.opacity = '0';
          aura.style.opacity = '0.9';
          tag.style.opacity = '1';
          continue;
        }

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

        const bob = s.idleUntil ? 0 : Math.sin(t * s.bobFreq + s.bobPhase) * s.bobAmp;
        const sway = s.idleUntil ? 0 : Math.sin(t * s.bobFreq * 2 + s.bobPhase) * 1.1;
        const lift = s.hover ? 1.09 : 1;
        wrap.style.transform = `translate3d(${(s.x / 100) * rect.width}px, ${s.y}px, 0)`;
        img.style.transform = `scale(${s.dir * s.scale * lift}, ${s.scale * lift}) translateY(${bob}px) rotate(${s.tilt + sway}deg)`;
        sh.style.opacity = String(0.3 + s.band * 0.12);
        aura.style.opacity = s.hover ? '0.6' : '0';
        tag.style.opacity = s.hover ? '1' : '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      window.removeEventListener('pointermove', onMove);
      handlers.forEach((h) => {
        if (h.el) {
          h.el.removeEventListener('pointerenter', h.enter);
          h.el.removeEventListener('pointerleave', h.leave);
          h.el.removeEventListener('click', h.click);
        }
      });
    };
  }, [sprites]);

  return (
    <div className="rw-scene" ref={sceneRef} aria-label="Robot world — click a robot to make it follow your cursor">
      <div className="rw-stage">
        <div className="rw-sky" />
        <div className="rw-horizon" />
        <div className="rw-glow rw-glow-a" />
        <div className="rw-glow rw-glow-b" />
        <div className="rw-grid" />
        <div className="rw-platform rw-platform-back" />
        <div className="rw-platform rw-platform-mid" />
        <div className="rw-platform rw-platform-front" />
      </div>
      {sprites.map((s, i) => (
        <div
          key={i}
          className="rw-sprite"
          data-sprite={i}
          role="button"
          tabIndex={-1}
          title={s.card.name}
          style={{ zIndex: s.z, transform: `translate3d(${s.x}px, ${s.y}px, 0)` }}
        >
          <span className="rw-aura" data-aura={i} style={{ ['--rc' as string]: RARITY_COLOR[s.card.rarity] }} />
          <img
            className="rw-robot"
            data-robot={i}
            src={s.card.image}
            alt=""
            decoding="async"
            draggable={false}
            style={{
              transform: `scale(${s.dir * s.scale}, ${s.scale})`,
              filter: s.blur ? `blur(${s.blur}px) brightness(0.94)` : undefined,
            }}
          />
          <span className="rw-tag" data-tag={i}>
            <strong>{s.card.name}</strong>
            <em style={{ color: RARITY_COLOR[s.card.rarity] }}>{s.card.rarity}</em>
          </span>
          <span className="rw-shadow" data-shadow={i} style={{ transform: `scale(${s.scale}, 1)`, opacity: 0.3 + s.band * 0.12 }} />
        </div>
      ))}
      <div className="rw-sparkles">
        {SPARKLES.map((p, i) => (
          <span key={i} className={`bg-sparkle${p.cls}`} style={{ left: p.left, top: p.top, animationDelay: p.delay }} />
        ))}
      </div>
      <div className="rw-sweep" />
      <div className="rw-fog" />
      <div className="rw-vignette" />
    </div>
  );
}
