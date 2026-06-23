import React, { useState } from 'react';
import type { NormalizedRecord } from '../types/agmarknet.types';

interface AgmarknetTableProps {
  data: {
    columns: any[];
    records: NormalizedRecord[];
    reported_dates: string[];
    source: string;
    stale: boolean;
  };
  filters?: any;
  filterData?: any;
}

export const AgmarknetTable: React.FC<AgmarknetTableProps> = ({ data, filters, filterData }) => {
  const { columns, records, reported_dates } = data;
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  if (!records || records.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No records found for selected criteria.
      </div>
    );
  }

  const priceGroup = columns?.find(c => c.key === 'price_group');
  const arrivalGroup = columns?.find(c => c.key === 'arrival_group');

  const pTitles = priceGroup?.columns?.map((c: any) => c.title) || ['', '', ''];
  const aTitles = arrivalGroup?.columns?.map((c: any) => c.title) || ['', '', ''];

  const latestDate = reported_dates && reported_dates.length > 0 ? reported_dates[0] : 'Unknown';

  // Pagination logic
  const totalPages = Math.ceil(records.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedRecords = records.slice(startIndex, startIndex + recordsPerPage);

  const handleNext = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
  const handlePrev = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };
  const handlePage = (page: number) => setCurrentPage(page);

  // Determine state name for info bar
  let stateName = 'All States';
  if (filters && filters.state !== 100006 && filterData?.state_data) {
    const s = filterData.state_data.find((x: any) => x.state_id === filters.state);
    if (s) stateName = s.state_name;
  }

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Info bar */}
      <div className="bg-gray-50 border border-gray-200 rounded-md py-3 px-4 text-sm text-gray-600">
        <span className="font-bold text-gray-900">{stateName}</span> | Data Freeze Up to {latestDate} | Showing {records.length} records
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-b border-gray-200 align-middle">Commodity Group</th>
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-b border-gray-200 align-middle">Commodity</th>
              <th rowSpan={2} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-b border-gray-200 align-middle">MSP (Rs./Quintal) 2025-26</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-b border-gray-200">Price (Rs./Quintal)</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Arrival (Metric Tonnes)</th>
            </tr>
            <tr>
              {pTitles.map((t: string, i: number) => (
                <th key={`pt-${i}`} className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-b border-gray-200 whitespace-nowrap">
                  {t}
                </th>
              ))}
              {aTitles.map((t: string, i: number) => (
                <th key={`at-${i}`} className={`px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap ${i < 2 ? 'border-r' : ''}`}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedRecords.map((row, idx) => (
              <tr key={`${row.commodity}-${idx}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">{row.commodity_group}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 border-r border-gray-200">{row.commodity}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-500 border-r border-gray-200">
                  {row.msp_price_rs_per_quintal ? row.msp_price_rs_per_quintal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
                
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-700 border-r border-gray-200">
                  {row.price.as_on.value ? row.price.as_on.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-700 border-r border-gray-200">
                  {row.price.one_day_ago.value ? row.price.one_day_ago.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-700 border-r border-gray-200">
                  {row.price.two_day_ago.value ? row.price.two_day_ago.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
                
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-700 border-r border-gray-200">
                  {row.arrival_metric_tonnes.as_on.value ? row.arrival_metric_tonnes.as_on.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-700 border-r border-gray-200">
                  {row.arrival_metric_tonnes.one_day_ago.value ? row.arrival_metric_tonnes.one_day_ago.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                  {row.arrival_metric_tonnes.two_day_ago.value ? row.arrival_metric_tonnes.two_day_ago.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={handlePrev} 
              disabled={currentPage === 1}
              style={{ padding: '6px 12px', background: currentPage === 1 ? '#f1f5f9' : 'white', border: 'none', color: currentPage === 1 ? '#94a3b8' : '#2563eb', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              &lt; Previous
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Basic logic to show first few pages
              let pageNum = i + 1;
              if (currentPage > 3 && totalPages > 5) {
                 pageNum = currentPage - 2 + i;
                 if (pageNum > totalPages) pageNum = totalPages - 4 + i;
              }
              return (
                <button 
                  key={pageNum}
                  onClick={() => handlePage(pageNum)}
                  style={{ 
                    padding: '6px 12px', 
                    background: currentPage === pageNum ? '#2563eb' : 'white', 
                    color: currentPage === pageNum ? 'white' : '#1e293b',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer' 
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button 
              onClick={handleNext} 
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px', background: currentPage === totalPages ? '#f1f5f9' : '#2563eb', border: 'none', color: currentPage === totalPages ? '#94a3b8' : 'white', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next &gt;
            </button>
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            Page {currentPage} of {totalPages} (Showing {paginatedRecords.length} of {records.length} records)
          </div>
        </div>
      )}
    </div>
  );
};
