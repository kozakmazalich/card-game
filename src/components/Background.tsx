import { useMemo } from 'react';

/**
 * Global background: pure solid black with sparse, professional breathing
 * lights. Every light glows up and fades out on its own randomized rhythm.
 */

interface Light {
  left: string;
  top: string;
  size: number;
  cls: string;
  ld: number;
  ldur: number;
}

const PALETTE = ['g', 'i', 'a'];

export default function Background() {
  const lights = useMemo<Light[]>(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 41.7 + 6) % 94}%`,
        top: `${(i * 29.3 + 4) % 90}%`,
        size: 160 + ((i * 53) % 180),
        cls: PALETTE[i % 3],
        ld: -((i * 3.1) % 13),
        ldur: 11 + ((i * 2.7) % 9),
      })),
    [],
  );

  return (
    <div className="bg" aria-hidden="true">
      {lights.map((l, i) => (
        <span
          key={i}
          className={`bg-light ${l.cls}`}
          style={{
            left: l.left,
            top: l.top,
            width: l.size,
            height: l.size,
            ['--ld' as string]: `${l.ld}s`,
            ['--ldur' as string]: `${l.ldur}s`,
          }}
        />
      ))}
    </div>
  );
}
