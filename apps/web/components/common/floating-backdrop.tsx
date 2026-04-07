'use client';

import { cn } from '@/lib/utils';

/** Pontos 5px — durações mais curtas (6–11s) para movimento visível. */
const MICRO_DOTS: { left: string; top: string; delay: string; duration: string; variant: 'a' | 'b' }[] = [
  { left: '8%', top: '12%', delay: '0s', duration: '8s', variant: 'a' },
  { left: '18%', top: '78%', delay: '0.6s', duration: '9.5s', variant: 'b' },
  { left: '92%', top: '22%', delay: '0.2s', duration: '7s', variant: 'a' },
  { left: '72%', top: '88%', delay: '1.1s', duration: '10s', variant: 'b' },
  { left: '5%', top: '45%', delay: '0.4s', duration: '8.5s', variant: 'b' },
  { left: '38%', top: '8%', delay: '0.9s', duration: '11s', variant: 'a' },
  { left: '55%', top: '92%', delay: '0.1s', duration: '6.5s', variant: 'a' },
  { left: '88%', top: '55%', delay: '1.3s', duration: '9s', variant: 'b' },
  { left: '25%', top: '62%', delay: '0.5s', duration: '8s', variant: 'b' },
  { left: '65%', top: '18%', delay: '1s', duration: '10.5s', variant: 'a' },
  { left: '12%', top: '88%', delay: '0.3s', duration: '7.5s', variant: 'a' },
  { left: '48%', top: '38%', delay: '1.4s', duration: '9s', variant: 'b' },
  { left: '82%', top: '72%', delay: '0.15s', duration: '8s', variant: 'b' },
  { left: '33%', top: '28%', delay: '0.7s', duration: '9.5s', variant: 'a' },
  { left: '95%', top: '8%', delay: '1s', duration: '10s', variant: 'b' },
  { left: '60%', top: '48%', delay: '0.45s', duration: '7s', variant: 'a' },
  { left: '15%', top: '30%', delay: '1.2s', duration: '8.5s', variant: 'b' },
  { left: '75%', top: '42%', delay: '0.25s', duration: '9s', variant: 'a' },
];

/** Pontos 3px — ainda mais rápidos (5–8s). */
const TINY_DOTS: { left: string; top: string; delay: string; duration: string; variant: 'a' | 'b' }[] = [
  { left: '22%', top: '15%', delay: '0s', duration: '6s', variant: 'a' },
  { left: '44%', top: '22%', delay: '0.4s', duration: '5.5s', variant: 'b' },
  { left: '66%', top: '12%', delay: '0.8s', duration: '7s', variant: 'a' },
  { left: '30%', top: '55%', delay: '0.2s', duration: '5s', variant: 'b' },
  { left: '52%', top: '68%', delay: '1s', duration: '6.5s', variant: 'b' },
  { left: '78%', top: '35%', delay: '0.1s', duration: '5.5s', variant: 'a' },
  { left: '10%', top: '68%', delay: '0.7s', duration: '7.5s', variant: 'a' },
  { left: '40%', top: '82%', delay: '0.3s', duration: '5s', variant: 'b' },
  { left: '58%', top: '58%', delay: '1.1s', duration: '6s', variant: 'b' },
  { left: '90%', top: '42%', delay: '0.55s', duration: '5.5s', variant: 'a' },
  { left: '28%', top: '42%', delay: '0.9s', duration: '7s', variant: 'b' },
  { left: '70%', top: '8%', delay: '0.25s', duration: '5s', variant: 'a' },
];

const SOFT_ORBS: { left: string; top: string; size: string; delay: string; duration: string }[] = [
  { left: '-5%', top: '10%', size: 'min(45vw, 320px)', delay: '0s', duration: '14s' },
  { left: '70%', top: '-8%', size: 'min(38vw, 280px)', delay: '2s', duration: '17s' },
  { left: '55%', top: '60%', size: 'min(42vw, 300px)', delay: '1s', duration: '15s' },
  { left: '5%', top: '70%', size: 'min(32vw, 220px)', delay: '1.5s', duration: '12s' },
  { left: '85%', top: '75%', size: 'min(28vw, 200px)', delay: '0.4s', duration: '16s' },
];

const EASING = 'cubic-bezier(0.42, 0, 0.58, 1)';

type AnimName =
  | 'backdrop-float-orb'
  | 'backdrop-float-micro-a'
  | 'backdrop-float-micro-b'
  | 'backdrop-float-tiny-a'
  | 'backdrop-float-tiny-b';

function motionStyle(duration: string, delay: string, name: AnimName) {
  return {
    animation: `${name} ${duration} ${EASING} infinite`,
    animationDelay: delay,
    willChange: 'transform, opacity',
  } as const;
}

/**
 * Fundo decorativo do login: orbes + pontos com trajetórias amplas e ciclos curtos.
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
          className="absolute rounded-full bg-primary/45 dark:bg-primary/28"
          key={`micro-${i}`}
          style={{
            left: d.left,
            top: d.top,
            width: 5,
            height: 5,
            ...motionStyle(d.duration, d.delay, d.variant === 'a' ? 'backdrop-float-micro-a' : 'backdrop-float-micro-b'),
          }}
        />
      ))}
      {TINY_DOTS.map((d, i) => (
        <div
          className="absolute rounded-full bg-primary/30 dark:bg-primary/18"
          key={`tiny-${i}`}
          style={{
            left: d.left,
            top: d.top,
            width: 3,
            height: 3,
            ...motionStyle(d.duration, d.delay, d.variant === 'a' ? 'backdrop-float-tiny-a' : 'backdrop-float-tiny-b'),
          }}
        />
      ))}
    </div>
  );
}
