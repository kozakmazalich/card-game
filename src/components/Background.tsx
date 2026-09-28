import { useMemo } from 'react';
import { CARDS } from '../data/cards';

interface Sparkle {
  left: string;
  top: string;
  delay: string;
  cls: string;
}

export default function Background() {
  const silhouettes = useMemo(() => {
    const picks = [CARDS[7], CARDS[41], CARDS[77]].filter(Boolean);
    return picks;
  }, []);

  const sparkles = useMemo<Sparkle[]>(() => {
    const palette = ['', ' iris', ' amber'];
    return Array.from({ length: 26 }, (_, i) => ({
      left: `${(i * 37.7) % 100}%`,
      top: `${(i * 53.3 + 11) % 92}%`,
      delay: `${(i % 9) * 0.8}s`,
      cls: palette[i % 3],
    }));
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-orb o1" />
      <div className="bg-orb o2" />
      <div className="bg-silhouettes">
        {silhouettes.map((c, i) => (
          <img key={i} src={c.image} alt="" loading="lazy" />
        ))}
      </div>
      <div className="bg-sparkles">
        {sparkles.map((s, i) => (
          <span key={i} className={`bg-sparkle${s.cls}`} style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
        ))}
      </div>
    </div>
  );
}
