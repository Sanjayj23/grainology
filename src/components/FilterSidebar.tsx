'use client';

import { useState, useEffect } from 'react';
import type { PriceRecord, FilterState } from '@/lib/types';
import { getAggregatedOptions } from '@/lib/dataFetcher';
import styles from './FilterSidebar.module.css';

interface Props {
  allData: Record<string, PriceRecord[]>;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const ALL = 'all';

export default function FilterSidebar({ allData, filters, onChange }: Props) {
  const allRecords = Object.values(allData).flat();

  // Cascading options
  const states = getAggregatedOptions(allData, 'state');
  const districts = filters.state !== ALL
    ? Array.from(new Set(allRecords.filter(r => r.state === filters.state).map(r => r.district))).sort()
    : [];
  const markets = filters.district !== ALL
    ? Array.from(new Set(allRecords.filter(r => r.state === filters.state && r.district === filters.district).map(r => r.market))).sort()
    : filters.state !== ALL
      ? Array.from(new Set(allRecords.filter(r => r.state === filters.state).map(r => r.market))).sort()
      : [];
  const commodities = getAggregatedOptions(allData, 'commodity');
  const varieties = filters.commodity !== ALL
    ? Array.from(new Set(allRecords.filter(r => r.commodity === filters.commodity).map(r => r.variety).filter(Boolean))).sort()
    : [];

  function update(key: keyof FilterState, val: string) {
    const next = { ...filters, [key]: val };
    // Reset downstream filters on change
    if (key === 'state') { next.district = ALL; next.market = ALL; }
    if (key === 'district') { next.market = ALL; }
    if (key === 'commodity') { next.variety = ALL; }
    onChange(next);
  }

  function reset() {
    onChange({ state: ALL, district: ALL, market: ALL, commodity: ALL, variety: ALL, date: '' });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>Filters</span>
        <button className={styles.resetBtn} onClick={reset}>Reset</button>
      </div>

      <FilterGroup
        label="State"
        value={filters.state}
        options={states}
        onChange={v => update('state', v)}
        placeholder="All States"
      />

      <FilterGroup
        label="District"
        value={filters.district}
        options={districts}
        onChange={v => update('district', v)}
        placeholder="All Districts"
        disabled={filters.state === ALL}
      />

      <FilterGroup
        label="Market / Mandi"
        value={filters.market}
        options={markets}
        onChange={v => update('market', v)}
        placeholder="All Markets"
        disabled={filters.state === ALL}
      />

      <FilterGroup
        label="Commodity"
        value={filters.commodity}
        options={commodities}
        onChange={v => update('commodity', v)}
        placeholder="All Commodities"
      />

      <FilterGroup
        label="Variety"
        value={filters.variety}
        options={varieties}
        onChange={v => update('variety', v)}
        placeholder="All Varieties"
        disabled={filters.commodity === ALL || varieties.length === 0}
      />

      <div className={styles.divider} />

      <div className={styles.quickSelects}>
        <span className={styles.quickLabel}>Quick select</span>
        {['Onion', 'Wheat', 'Tomato', 'Potato', 'Rice', 'Maize'].map(c => (
          <button
            key={c}
            className={`${styles.chip} ${filters.commodity === c ? styles.chipActive : ''}`}
            onClick={() => update('commodity', c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.quickSelects}>
        <span className={styles.quickLabel}>Popular states</span>
        {['Maharashtra', 'Uttar Pradesh', 'Rajasthan', 'Karnataka', 'Punjab'].map(s => (
          <button
            key={s}
            className={`${styles.chip} ${filters.state === s ? styles.chipActive : ''}`}
            onClick={() => update('state', s)}
          >
            {s}
          </button>
        ))}
      </div>
    </aside>
  );
}

interface FilterGroupProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}

function FilterGroup({ label, value, options, onChange, placeholder, disabled }: FilterGroupProps) {
  return (
    <div className={`${styles.group} ${disabled ? styles.disabled : ''}`}>
      <label className={styles.label}>{label}</label>
      <div className={styles.selectWrapper}>
        <select
          className={styles.select}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value={ALL}>{placeholder}</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <span className={styles.caret}>▾</span>
      </div>
    </div>
  );
}
