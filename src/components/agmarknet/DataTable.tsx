import React from 'react';
import type { CommodityRecord } from '../services/api';

interface DataTableProps {
  records: CommodityRecord[];
}

export const DataTable: React.FC<DataTableProps> = ({ records }) => {
  if (!records || records.length === 0) {
    return null;
  }

  // Only show the latest 20 records in the table to keep it clean
  const displayRecords = records.slice(0, 20);

  return (
    <div className="glass-panel" style={{ overflowX: 'auto', padding: '0' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)' }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Latest Transactions</h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <th style={{ padding: '16px 24px', fontWeight: 500 }}>Date</th>
            <th style={{ padding: '16px 24px', fontWeight: 500 }}>Market</th>
            <th style={{ padding: '16px 24px', fontWeight: 500 }}>Variety</th>
            <th style={{ padding: '16px 24px', fontWeight: 500 }}>Min Price</th>
            <th style={{ padding: '16px 24px', fontWeight: 500 }}>Max Price</th>
            <th style={{ padding: '16px 24px', fontWeight: 500 }}>Modal Price</th>
          </tr>
        </thead>
        <tbody>
          {displayRecords.map((record, index) => (
            <tr key={`${record.Arrival_Date}-${record.Market}-${record.Variety}-${index}`} style={{ borderBottom: '1px solid var(--panel-border)', transition: 'background 0.2s' }}>
              <td style={{ padding: '16px 24px', fontSize: '14px' }}>{record.Arrival_Date}</td>
              <td style={{ padding: '16px 24px', fontSize: '14px' }}>{record.Market}, {record.State}</td>
              <td style={{ padding: '16px 24px', fontSize: '14px' }}>{record.Variety}</td>
              <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)' }}>₹{record.Min_Price}</td>
              <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)' }}>₹{record.Max_Price}</td>
              <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 600, color: 'var(--accent-color)' }}>₹{record.Modal_Price}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 20 && (
        <div style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Showing 20 of {records.length} records fetched
        </div>
      )}
    </div>
  );
};
