import { useEffect, useRef, useState } from 'react';
import type { SiteStat } from '../lib/siteSettings';

function CounterValue({ stat, className }: { stat: SiteStat; className: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = valueRef.current;
    if (!node || hasAnimated) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        setHasAnimated(true);
        const duration = 1400;
        const start = performance.now();

        const animate = (time: number) => {
          const progress = Math.min((time - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.round(stat.value * eased));

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasAnimated, stat.value]);

  const formattedValue = displayValue.toLocaleString('en-IN');

  return (
    <div ref={valueRef} className={className}>
      {stat.prefix}
      {formattedValue}
      {stat.suffix}
    </div>
  );
}

type SiteStatsGridProps = {
  stats: SiteStat[];
  variant?: 'light' | 'dark';
  showDescription?: boolean;
};

export default function SiteStatsGrid({
  stats,
  variant = 'light',
  showDescription = true
}: SiteStatsGridProps) {
  const isDark = variant === 'dark';

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={
            isDark
              ? 'rounded-xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-sm'
              : 'rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8f4eb_100%)] p-6 sm:p-7'
          }
        >
          <CounterValue
            stat={stat}
            className={
              isDark
                ? 'text-5xl font-black tracking-[-0.08em] text-white'
                : 'text-5xl font-black leading-none tracking-[-0.08em] text-emerald-700 sm:text-6xl lg:text-7xl'
            }
          />
          <p className={isDark ? 'mt-3 text-lg font-semibold text-green-100' : 'mt-4 text-xl font-semibold text-stone-900'}>
            {stat.label}
          </p>
          {showDescription && (
            <p className={isDark ? 'mt-3 text-sm leading-7 text-green-50/80' : 'mt-3 text-sm leading-7 text-stone-600'}>
              {stat.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
