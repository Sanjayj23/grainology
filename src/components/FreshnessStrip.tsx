'use client';

import { SOURCE_META } from '@/lib/types';
import type { ScrapeLogEntry } from '@/lib/types';
import styles from './FreshnessStrip.module.css';

interface Props {
  latestPerSource: Record<string, ScrapeLogEntry>;
}

function timeSince(isoString: string): string {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getFreshnessLevel(isoString: string, status: string): 'fresh' | 'stale' | 'error' {
  if (status === 'failed') return 'error';
  if (!isoString) return 'error';
  const diff = Date.now() - new Date(isoString).getTime();
  const hrs = diff / 3600000;
  if (hrs < 3) return 'fresh';
  if (hrs < 13) return 'stale';
  return 'error';
}

export default function FreshnessStrip({ latestPerSource }: Props) {
  const sources = ['agmarknet', 'enam', 'datagovin', 'indiadataportal'] as const;

  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}>Data Freshness</span>
      <div className={styles.badges}>
        {sources.map(source => {
          const entry = latestPerSource[source];
          const level = entry
            ? getFreshnessLevel(entry.finished_at, entry.status)
            : 'error';
          const ago = entry ? timeSince(entry.finished_at) : 'no data yet';
          const records = entry ? `${entry.records_valid.toLocaleString()} records` : '';
          const meta = SOURCE_META[source];

          return (
            <div
              key={source}
              className={`${styles.badge} ${styles[level]}`}
              title={`${meta.label}: ${records} — ${entry?.status || 'never run'}`}
            >
              <span
                className={styles.dot}
                style={{ background: level === 'fresh' ? '#22c55e' : level === 'stale' ? '#f59e0b' : '#ef4444' }}
              />
              <span className={styles.sourceName}>{meta.label}</span>
              <span className={styles.ago}>{ago}</span>
              {records && <span className={styles.records}>{records}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
