'use client';

import type { ComparisonRow } from '@/lib/types';
import styles from './ComparisonTable.module.css';

interface Props {
  rows: ComparisonRow[];
  loading?: boolean;
}

function PriceDelta({ rows }: { rows: ComparisonRow[] }) {
  const available = rows.filter(r => r.available && r.modal_price !== null);
  if (available.length < 2) return null;
  const prices = available.map(r => r.modal_price!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const delta = max - min;
  const pct = ((delta / min) * 100).toFixed(1);
  return (
    <div className={styles.deltaAlert}>
      <span className={styles.deltaIcon}>⚡</span>
      Price spread across sources: <strong>₹{delta.toFixed(0)}/quintal</strong> ({pct}% variance)
    </div>
  );
}

export default function ComparisonTable({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className={styles.skeleton}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={styles.skeletonRow} style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    );
  }

  const availableRows = rows.filter(r => r.available);
  const freshestDate = availableRows.length
    ? availableRows.sort((a, b) => b.price_date.localeCompare(a.price_date))[0].price_date
    : null;

  const maxModal = Math.max(...availableRows.map(r => r.modal_price || 0));

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableHeader}>
        <h2 className={styles.heading}>Price Comparison</h2>
        {freshestDate && (
          <span className={styles.dateTag}>
            Latest data: {new Date(freshestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      <PriceDelta rows={rows} />

      {!availableRows.length ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🌾</span>
          <span>No data for the selected filters.<br />Try broadening your selection or choosing a different commodity.</span>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Min Price</th>
                <th>Modal Price</th>
                <th>Max Price</th>
                <th>Arrivals</th>
                <th>Price Date</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.source}
                  className={`${styles.row} ${!row.available ? styles.rowUnavailable : ''} ${row.modal_price === maxModal && row.available ? styles.rowHighest : ''}`}
                >
                  <td>
                    <div className={styles.sourceCell}>
                      <span
                        className={styles.sourceDot}
                        style={{ background: row.color }}
                      />
                      <span className={styles.sourceLabel}>{row.label}</span>
                      {row.modal_price === maxModal && row.available && (
                        <span className={styles.freshBadge}>Highest</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.priceCell}>
                    {row.available && row.min_price !== null
                      ? <><span className={styles.rupee}>₹</span>{row.min_price.toLocaleString('en-IN')}</>
                      : <span className={styles.na}>—</span>}
                  </td>
                  <td className={styles.priceCell}>
                    {row.available && row.modal_price !== null ? (
                      <div className={styles.modalPriceWrapper}>
                        <span className={styles.rupee}>₹</span>
                        <span className={styles.modalPrice}>{row.modal_price.toLocaleString('en-IN')}</span>
                        {row.available && (
                          <div
                            className={styles.priceBar}
                            style={{ width: `${(row.modal_price / maxModal) * 100}%`, background: row.color }}
                          />
                        )}
                      </div>
                    ) : <span className={styles.na}>—</span>}
                  </td>
                  <td className={styles.priceCell}>
                    {row.available && row.max_price !== null
                      ? <><span className={styles.rupee}>₹</span>{row.max_price.toLocaleString('en-IN')}</>
                      : <span className={styles.na}>—</span>}
                  </td>
                  <td className={styles.arrivalsCell}>
                    {row.arrivals_tonnes !== null && row.arrivals_tonnes !== undefined
                      ? `${row.arrivals_tonnes.toFixed(1)} T`
                      : <span className={styles.na}>—</span>}
                  </td>
                  <td className={styles.dateCell}>
                    {row.available && row.price_date
                      ? new Date(row.price_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : <span className={styles.na}>—</span>}
                  </td>
                  <td className={styles.updatedCell}>
                    {row.available && row.fetched_at
                      ? timeAgo(row.fetched_at)
                      : <span className={styles.naText}>No data</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.footnote}>
        All prices in ₹/quintal. Modal price = the most common traded price.
        Source data refreshes every 2 hours via automated scrapers.
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
