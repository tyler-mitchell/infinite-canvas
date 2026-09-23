import type { TimedDOMSegment } from "../motion.ts";

export interface ParticleOptions {
  readonly count?: number;
  readonly lifetime?: number;
  readonly speed?: number;
  readonly spread?: number;
  readonly size?: number;
  readonly gravity?: number;
  readonly variation?: number;
  readonly coolingFilters?: readonly [string, string, string, string];
}

export interface ParticleFieldProps {
  readonly ref?: React.Ref<HTMLDivElement>;
  readonly count?: number;
  readonly groups?: number;
  readonly className?: string;
}

export function ParticleField({ ref, count = 12, groups = 3, className = "" }: ParticleFieldProps) {
  const length = Number.isFinite(count) ? Math.max(0, Math.min(26, Math.floor(count))) : 12;
  const groupCount = Number.isFinite(groups) ? Math.max(1, Math.min(12, Math.floor(groups))) : 3;
  return (
    <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 z-10 ${className}`}>
      {Array.from({ length: groupCount }, (_, group) => (
        <div key={group} data-particle-group={group} className="absolute inset-0">
          {Array.from({ length }, (_, index) => (
            <span
              key={index}
              data-slot="particle"
              className="absolute left-0 top-0 size-0.5 rounded-full bg-[var(--particle-ember-color,#e76e27)] opacity-0"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function particleBurstSequence({
  element,
  x,
  y,
  at = 0,
  group = 0,
  lifetime = 0.48,
  speed = 190,
  spread = Math.PI * 1.5,
  size = 0.85,
  gravity = 120,
  variation = 0.15,
  coolingFilters = [
    "brightness(6) saturate(0.1)",
    "brightness(3) saturate(0.4)",
    "brightness(1.7) saturate(1)",
    "none",
  ],
}: ParticleOptions & {
  readonly element: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly at?: number;
  readonly group?: number;
}): TimedDOMSegment[] {
  const times = [0, 0.06, 0.24, 0.55, 1];
  const strength =
    1 +
    (Math.random() * 2 - 1) *
      (Number.isFinite(variation) ? Math.max(0, Math.min(0.5, variation)) : 0.15);
  const particles: TimedDOMSegment[] = [
    ...element.querySelectorAll<HTMLElement>(
      `[data-particle-group="${group}"] [data-slot="particle"]`,
    ),
  ].flatMap((particle): TimedDOMSegment[] => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const velocity = speed * strength * (0.45 + Math.random() * 0.8);
    const radius = size * Math.sqrt(strength) * (0.5 + Math.random() * 0.7);
    const duration = lifetime * (0.65 + Math.random() * 0.35);
    const streak = Math.random() < 0.25 ? 1 : 2 + Math.random() * 2;
    const sequence: TimedDOMSegment[] = [
      [
        particle,
        {
          transform: times.map((progress) => {
            const time = progress * duration;
            const travel = (1 - Math.exp(-5 * time)) / 5;
            const rotation = Math.atan2(
              Math.sin(angle) * velocity * Math.exp(-5 * time) + gravity * time,
              Math.cos(angle) * velocity * Math.exp(-5 * time),
            );
            const turn = angle + Math.atan2(Math.sin(rotation - angle), Math.cos(rotation - angle));
            return `translate(${x + Math.cos(angle) * velocity * travel}px, ${y + Math.sin(angle) * velocity * travel + (gravity * time * time) / 2}px) rotate(${turn}rad) scale(${radius * (1 + (streak - 1) * (1 - progress) ** 2)}, ${radius * (0.75 - progress * 0.4)})`;
          }),
          opacity: [0, 1, 0.9, 0.5, 0],
        },
        { at, duration, times, ease: "linear" },
      ],
    ];
    return sequence;
  });
  const field = element.querySelector<HTMLElement>(`[data-particle-group="${group}"]`);
  if (field)
    particles.push([
      field,
      { filter: [...coolingFilters] },
      { at, duration: lifetime, times: [0, 0.12, 0.35, 1], ease: "easeOut" },
    ]);
  return particles;
}
