import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#5bd08a', '#ccff00', '#8b87d9', '#e0b04e', '#ffffff', '#7ce8a4'];

interface Particle {
  left: number;
  top: number;
  px: number;
  py: number;
  pr: number;
  size: number;
  color: string;
  delay: number;
}

/** One-shot celebratory burst. Renders particles + optional flash. */
export function ParticleBurst({ count = 42, flash = false, origin = { x: 50, y: 45 } }: { count?: number; flash?: boolean; origin?: { x: number; y: number } }) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 260;
        return {
          left: origin.x,
          top: origin.y,
          px: Math.cos(angle) * dist,
          py: Math.sin(angle) * dist - 40,
          pr: (Math.random() - 0.5) * 540,
          size: 4 + Math.random() * 7,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          delay: Math.random() * 0.12,
        };
      }),
    [count, origin.x, origin.y],
  );

  return (
    <>
      {flash && (
        <motion.div
          className="flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, times: [0, 0.18, 1] }}
        />
      )}
      <div className="particles" aria-hidden="true">
        {particles.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              animationDelay: `${p.delay}s`,
              ['--px' as string]: `${p.px}px`,
              ['--py' as string]: `${p.py}px`,
              ['--pr' as string]: `${p.pr}deg`,
            }}
          />
        ))}
      </div>
    </>
  );
}

/** Red failure flash. */
export function FailureFlash() {
  return <motion.div className="flash red" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0] }} transition={{ duration: 0.42, times: [0, 0.2, 1] }} />;
}
