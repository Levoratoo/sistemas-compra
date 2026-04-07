'use client';

import { cn } from '@/lib/utils';

/** Pontos pequenos (5px) — quantidade maior, movimento orgânico. */
const MICRO_DOTS: { left: string; top: string; delay: string; duration: string }[] = [
  { left: '8%', top: '12%', delay: '0s', duration: '14s' },
  { left: '18%', top: '78%', delay: '1.2s', duration: '16s' },
  { left: '92%', top: '22%', delay: '0.4s', duration: '13s' },
  { left: '72%', top: '88%', delay: '2s', duration: '17s' },
  { left: '5%', top: '45%', delay: '0.8s', duration: '15s' },
  { left: '38%', top: '8%', delay: '1.5s', duration: '18s' },
  { left: '55%', top: '92%', delay: '0.2s', duration: '12s' },
  { left: '88%', top: '55%', delay: '2.2s', duration: '16s' },
  { left: '25%', top: '62%', delay: '1s', duration: '14s' },
  { left: '65%', top: '18%', delay: '1.8s', duration: '19s' },
  { left: '12%', top: '88%', delay: '0.6s', duration: '13s' },
  { left: '48%', top: '38%', delay: '2.4s', duration: '17s' },
  { left: '82%', top: '72%', delay: '0.3s', duration: '15s' },
  { left: '33%', top: '28%', delay: '1.1s', duration: '16s' },
  { left: '95%', top: '8%', delay: '1.6s', duration: '18s' },
  { left: '60%', top: '48%', delay: '0.9s', duration: '14s' },
  { left: '15%', top: '30%', delay: '2.1s', duration: '15s' },
  { left: '75%', top: '42%', delay: '0.5s', duration: '17s' },
];

/** Pontos minúsculos (3px) — mantidos para textura fina. */
const TINY_DOTS: { left: string; top: string; delay: string; duration: string }[] = [
  { left: '22%', top: '15%', delay: '0.1s', duration: '11s' },
  { left: '44%', top: '22%', delay: '0.7s', duration: '10s' },
  { left: '66%', top: '12%', delay: '1.3s', duration: '12s' },
  { left: '30%', top: '55%', delay: '0.4s', duration: '9s' },
  { left: '52%', top: '68%', delay: '1.9s', duration: '11s' },
  { left: '78%', top: '35%', delay: '0.2s', duration: '10s' },
  { left: '10%', top: '68%', delay: '1.4s', duration: '12s' },
  { left: '40%', top: '82%', delay: '0.6s', duration: '9s' },
  { left: '58%', top: '58%', delay: '2s', duration: '11s' },
  { left: '90%', top: '42%', delay: '1.1s', duration: '10s' },
  { left: '28%', top: '42%', delay: '1.7s', duration: '12s' },
  { left: '70%', top: '8%', delay: '0.5s', duration: '9s' },
];

const SOFT_ORBS: { left: string; top: string; size: string; delay: string; duration: string }[] = [
  { left: '-5%', top: '10%', size: 'min(45vw, 320px)', delay: '0s', duration: '22s' },
  { left: '70%', top: '-8%', size: 'min(38vw, 280px)', delay: '3s', duration: '26s' },
  { left: '55%', top: '60%', size: 'min(42vw, 300px)', delay: '1.5s', duration: '24s' },
  { left: '5%', top: '70%', size: 'min(32vw, 220px)', delay: '2s', duration: '20s' },
  { left: '85%', top: '75%', size: 'min(28vw, 200px)', delay: '0.8s', duration: '23s' },
];

function motionStyle(duration: string, delay: string, name: 'backdrop-float-orb' | 'backdrop-float-micro' | 'backdrop-float-tiny') {
  return {
    animation: `${name} ${duration} ease-in-out infinite`,
    animationDelay: delay,
  } as const;
}

/**
 * Fundo decorativo: orbes suaves + muitos pontos pequenos + pontos minúsculos, todos animados.
 * `prefers-reduced-motion` é respeitado pelas regras globais em globals.css.
 */
export function FloatingBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}>
      {SOFT_ORBS.map((orb, i) => (
        <div
          className="absolute rounded-full bg-primary/15 blur-3xl dark:bg-primary/10"
          key={`orb-${i}`}
          style={{
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            ...motionStyle(orb.duration, orb.delay, 'backdrop-float-orb'),
          }}
        />
      ))}
      {MICRO_DOTS.map((d, i) => (
        <div
          className="absolute rounded-full bg-primary/40 dark:bg-primary/25"
          key={`micro-${i}`}
          style={{
            left: d.left,
            top: d.top,
            width: 5,
            height: 5,
            ...motionStyle(d.duration, d.delay, 'backdrop-float-micro'),
          }}
        />
      ))}
      {TINY_DOTS.map((d, i) => (
        <div
          className="absolute rounded-full bg-primary/25 dark:bg-primary/15"
          key={`tiny-${i}`}
          style={{
            left: d.left,
            top: d.top,
            width: 3,
            height: 3,
            ...motionStyle(d.duration, d.delay, 'backdrop-float-tiny'),
          }}
        />
      ))}
    </div>
  );
}
