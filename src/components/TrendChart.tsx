'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Scatter, ScatterChart,
  ReferenceLine,
} from 'recharts';
import type { TrendDataPoint } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import styles from './TrendChart.module.css';

interface Props {
  data: TrendDataPoint[];
  loading?: boolean;
}

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
          <span className={styles.tooltipSource}>eNAM</span>
          <span className={styles.tooltipPrice}>₹{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return d; }
}

export default function TrendChart({ data, loading }: Props) {
  if (loading) {
    return <div className={styles.skeletonChart} />;
  }

  const enamColor = SOURCE_META.enam.color;
  const validPoints = data.filter(d => d.enam !== undefined && d.enam > 0);
  const hasData = validPoints.length > 0;
  const isSingleDay = validPoints.length === 1;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.heading}>30-Day Price Trend</h2>
        <div className={styles.toggles}>
          <span
            className={`${styles.toggle} ${styles.toggleOn}`}
            style={{ borderColor: enamColor, color: enamColor }}
          >
            <span className={styles.toggleDot} style={{ background: enamColor }} />
            eNAM
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className={styles.noData}>
          <span>📈</span>
          <span>Select a commodity and state to see price trends.</span>
        </div>
      ) : isSingleDay ? (
        /* Single-day: show a clean price card instead of a broken line */
        <div className={styles.singleDayWrapper}>
          <div className={styles.singleDayCard}>
            <div className={styles.singleDayLabel}>Today's Average Modal Price</div>
            <div className={styles.singleDayPrice} style={{ color: enamColor }}>
              ₹{validPoints[0].enam?.toLocaleString('en-IN')}
            </div>
            <div className={styles.singleDayDate}>{formatDate(validPoints[0].date)}</div>
            <div className={styles.singleDayNote}>
              Historical trend will build as daily syncs accumulate data.
            </div>
          </div>
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
              <Line
                type="monotone"
                dataKey="enam"
                stroke={enamColor}
                strokeWidth={2}
                dot={{ r: 3, fill: enamColor, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={styles.footnote}>
        Average modal price across all markets (₹/quintal) — sourced from eNAM live database
      </div>
    </div>
  );
}
