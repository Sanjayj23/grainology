'use client';

import { useState, useEffect } from 'react';
import FilterSidebar from '@/components/FilterSidebar';
import ComparisonTable from '@/components/ComparisonTable';
import TrendChart from '@/components/TrendChart';
import FreshnessStrip from '@/components/FreshnessStrip';
import type { PriceRecord, FilterState, ComparisonRow, TrendDataPoint, ScrapeLogEntry } from '@/lib/types';
import {
  fetchLatestAll,
  fetchScrapeLog,
  buildComparisonRows,
  buildTrendData,
  getLatestScrapePerSource,
} from '@/lib/dataFetcher';
import styles from './page.module.css';


const DEFAULT_FILTERS: FilterState = {
  state: 'all',
  district: 'all',
  market: 'all',
  commodity: 'all',
  variety: 'all',
  date: '',
};

export default function HomePage() {
  const [allData, setAllData] = useState<Record<string, PriceRecord[]>>({});
  const [scrapeLog, setScrapeLog] = useState<ScrapeLogEntry[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [data, log] = await Promise.all([
        fetchLatestAll(),
        fetchScrapeLog(),
      ]);
      setAllData(data);
      setScrapeLog(log);
      setLoading(false);
    }
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const comparisonRows: ComparisonRow[] = buildComparisonRows(allData, filters);
  const trendData: TrendDataPoint[] = buildTrendData(allData, filters, 30);
  const latestPerSource = getLatestScrapePerSource(scrapeLog);

  const totalRecords = Object.values(allData).reduce((sum, arr) => sum + arr.length, 0);
  const sourcesActive = Object.values(allData).filter(arr => arr.length > 0).length;

  return (
    <div className={styles.root}>
      {/* Background glow blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🌾</span>
            <div>
              <span className={styles.brandName}>Grainology</span>
              <span className={styles.brandTagline}>
                <span className={styles.liveDot} />
                Live Agricultural Price Intelligence
              </span>
            </div>
          </div>
          <div className={styles.headerStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{loading ? '—' : totalRecords.toLocaleString('en-IN')}</span>
              <span className={styles.statLabel}>Records loaded</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{sourcesActive}/4</span>
              <span className={styles.statLabel}>Sources active</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>2h</span>
              <span className={styles.statLabel}>Refresh cadence</span>
            </div>
          </div>
        </div>
      </header>

      {/* Freshness Strip */}
      <div className={styles.freshnessWrapper}>
        <FreshnessStrip latestPerSource={latestPerSource} />
      </div>

      {/* Main layout */}
      <main className={styles.main}>
        <FilterSidebar
          allData={allData}
          filters={filters}
          onChange={setFilters}
        />

        <div className={styles.content}>
          {/* Active filter summary */}
          {(filters.commodity !== 'all' || filters.state !== 'all') && (
            <div className={styles.filterSummary}>
              <span className={styles.filterSummaryIcon}>🔍</span>
              Showing:
              {filters.commodity !== 'all' && <strong> {filters.commodity}</strong>}
              {filters.variety !== 'all' && <span> ({filters.variety})</span>}
              {filters.state !== 'all' && <span> in <strong>{filters.state}</strong></span>}
              {filters.district !== 'all' && <span> › {filters.district}</span>}
              {filters.market !== 'all' && <span> › {filters.market}</span>}
            </div>
          )}

          <ComparisonTable rows={comparisonRows} loading={loading} />
          <TrendChart data={trendData} loading={loading} />
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          Data sourced from{' '}
          <a href="https://agmarknet.gov.in" target="_blank" rel="noopener noreferrer">Agmarknet</a>,{' '}
          <a href="https://enam.gov.in" target="_blank" rel="noopener noreferrer">eNAM</a>,{' '}
          <a href="https://data.gov.in" target="_blank" rel="noopener noreferrer">data.gov.in</a>,{' '}
          <a href="https://indiadataportal.com" target="_blank" rel="noopener noreferrer">IndiaDataPortal</a>.
          Prices are indicative only. Not for trading decisions.
        </p>
      </footer>
    </div>
  );
}
