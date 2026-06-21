'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import type { PriceRecord, TrendDataPoint } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import styles from './TrendChart.module.css';

interface Props {
  data: TrendDataPoint[];
  loading?: boolean;
}

const SOURCES: PriceRecord['source'][] = [
  'vegetablemarketprice',
  'datagovin',
  'enam',
  'agmarknet',
  'indiadataportal',
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{label}</div>
      {payload.map(p => (
        <div key={p.name} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipSource}>
            {SOURCE_META[p.name as keyof typeof SOURCE_META]?.label || p.name}
          </span>
          <span className={styles.tooltipPrice}>₹{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({ data, loading }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(SOURCES.map(source => [source, true]))
  );

  function formatDate(d: string) {
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return d; }
  }

  if (loading) {
    return <div className={styles.skeletonChart} />;
  }

  const hasData = data.some(d => SOURCES.some(s => d[s] !== undefined));

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.heading}>30-Day Price Trend</h2>
        <div className={styles.toggles}>
          {SOURCES.map(s => {
            const meta = SOURCE_META[s];
            return (
              <button
                key={s}
                className={`${styles.toggle} ${enabled[s] ? styles.toggleOn : styles.toggleOff}`}
                style={enabled[s] ? { borderColor: meta.color, color: meta.color } : {}}
                onClick={() => setEnabled(prev => ({ ...prev, [s]: !prev[s] }))}
              >
                <span
                  className={styles.toggleDot}
                  style={{ background: enabled[s] ? meta.color : 'rgba(255,255,255,0.2)' }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasData ? (
        <div className={styles.noData}>
          <span>📈</span>
          <span>Trend data appears here once filters are applied and historical data is available.</span>
        </div>
      ) : (
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              {SOURCES.map(s =>
                enabled[s] ? (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    stroke={SOURCE_META[s].color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={styles.footnote}>
        Modal price (₹/quintal) — toggle sources above to compare
      </div>
    </div>
  );
}
