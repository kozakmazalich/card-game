import { useEffect, useMemo, useRef } from 'react';
import { CARDS } from '../data/cards';
import type { Rarity, RobotCard } from '../data/types';
import { sfx } from '../game/sounds';

/**
 * The home world: a black scene with one conveyor road. Robots stand
 * completely still in their slots and are carried forward by the conveyor —
 * robot and belt move as one connected system. Reaching the edge, a robot
 * loops back naturally. Clicking a robot still lets it chase the cursor;
 * releasing it drops it back onto the conveyor.
 */

const PICK_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa1a6',
  uncommon: '#5bd08a',
  rare: '#8b87d9',
  epic: '#e0b04e',
  legendary: '#ccff00',
};

const ROAD_Y = 232;
const SPEED = 24; // conveyor px/s (kept in sync with the road-mark animation)
const MARGIN = 110; // off-screen margin used for the seamless loop

const LAMPS = [
  { left: '6%', ld: -2, ldur: 13 },
  { left: '21%', ld: -8, ldur: 10 },
  { left: '36%', ld: -5, ldur: 15 },
  { left: '53%', ld: -11, ldur: 9 },
  { left: '69%', ld: -3, ldur: 12 },
  { left: '85%', ld: -7, ldur: 14 },
];

interface Sprite {
  card: RobotCard;
  /** Fixed slot on the conveyor, as a fraction of one loop length. */
  slotFrac: number;
  y: number;
  tilt: number;
  z: number;
  following: boolean;
  fx: number;
  fy: number;
  hover: boolean;
}

function makeSprites(): Sprite[] {
  const picks: RobotCard[] = PICK_ORDER.flatMap((r) => CARDS.filter((c) => c.rarity === r).slice(0, 2));
  return picks.map((card, i) => {
    const r = (n: number) => (Math.abs(Math.sin(i * 9301 + n * 49297)) * 233280) % 1;
    const y = ROAD_Y + (i % 2 === 0 ? 5 : -4);
    return {
      card,
      slotFrac: i / picks.length,
      y,
      tilt: (r(5) - 0.5) * 3,
      z: 10 + Math.round((y - 220) / 4),
      following: false,
      fx: 0,
      fy: 0,
      hover: false,
    };
  });
}

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

    let scroll = 0; // conveyor displacement in px

    const release = (s: Sprite, wrap: HTMLElement | null) => {
      // Re-attach to the conveyor at the exact spot where the robot stands,
      // preserving its position relative to the belt.
      const L = rect.width + 2 * MARGIN;
      const screenX = s.fx - rect.left;
      s.slotFrac = ((((screenX + MARGIN - scroll) % L) + L) % L) / L;
      s.y = ROAD_Y;
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

    const cleanup = () => {
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

    const placeStatic = () => {
      const L = rect.width + 2 * MARGIN;
      sprites.forEach((s, i) => {
        const wrap = wraps[i];
        if (!wrap) return;
        const x = (s.slotFrac * L + scroll) % L - MARGIN;
        wrap.style.transform = `translate3d(${x}px, ${s.y}px, 0)`;
      });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      placeStatic();
      return cleanup;
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now * 0.001;
      const L = rect.width + 2 * MARGIN;
      scroll += SPEED * dt;

      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        const wrap = wraps[i];
        const img = robots[i];
        const sh = shadows[i];
        const aura = auras[i];
        const tag = tags[i];
        if (!wrap || !img || !sh || !aura || !tag) continue;

        if (s.following) {
          const k = 0.15;
          const vx = (mouse.current.x - s.fx) * k;
          const vy = (mouse.current.y - s.fy) * k;
          s.fx += vx;
          s.fy += vy;
          const bank = Math.max(-16, Math.min(16, vx * 1.6));
          const bob = Math.sin(t * 9 + s.tilt) * 5;
          wrap.style.transform = `translate3d(${s.fx - 75}px, ${s.fy - 150}px, 0)`;
          img.style.transform = `scale(1.55, 1.55) translateY(${bob}px) rotate(${bank}deg)`;
          sh.style.opacity = '0';
          aura.style.opacity = '0.9';
          tag.style.opacity = '1';
          continue;
        }

        // Carried by the conveyor — the robot itself stays still.
        const x = ((s.slotFrac * L + scroll) % L) - MARGIN;
        wrap.style.transform = `translate3d(${x}px, ${s.y}px, 0)`;
        img.style.transform = `scale(1, 1) rotate(${s.tilt}deg)`;
        sh.style.opacity = '0.32';
        aura.style.opacity = s.hover ? '0.55' : '0';
        tag.style.opacity = s.hover ? '1' : '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [sprites]);

  return (
    <div className="rw-scene" ref={sceneRef} aria-label="Robot conveyor — robots travel on a moving road. Click one to make it follow your cursor.">
      <div className="rw-lamps" aria-hidden="true">
        {LAMPS.map((l, i) => (
          <span key={i} className="rw-lamp" style={{ left: l.left, ['--ld' as string]: `${l.ld}s`, ['--ldur' as string]: `${l.ldur}s` }}>
            <span className="rw-lamp-head" />
            <span className="rw-lamp-pole" />
            <span className="rw-lamp-cone" />
            <span className="rw-lamp-reflect" />
          </span>
        ))}
      </div>
      <div className="rw-road" aria-hidden="true">
        <span className="rw-road-edge rw-road-top" />
        <span className="rw-road-marks" />
        <span className="rw-road-center" />
        <span className="rw-road-edge rw-road-bottom" />
      </div>
      {sprites.map((s, i) => (
        <div
          key={i}
          className="rw-sprite"
          data-sprite={i}
          role="button"
          tabIndex={-1}
          title={s.card.name}
          style={{ zIndex: s.z, transform: `translate3d(${s.slotFrac * 100}px, ${s.y}px, 0)` }}
        >
          <span className="rw-aura" data-aura={i} style={{ ['--rc' as string]: RARITY_COLOR[s.card.rarity] }} />
          <img
            className="rw-robot"
            data-robot={i}
            src={s.card.image.replace('/robots/', '/robots-cutout/')}
            alt=""
            decoding="async"
            draggable={false}
            style={{ transform: `scale(1, 1) rotate(${s.tilt}deg)` }}
          />
          <span className="rw-tag" data-tag={i}>
            <strong>{s.card.name}</strong>
            <em style={{ color: RARITY_COLOR[s.card.rarity] }}>{s.card.rarity}</em>
          </span>
          <span className="rw-shadow" data-shadow={i} style={{ opacity: 0.32 }} />
        </div>
      ))}
    </div>
  );
}
