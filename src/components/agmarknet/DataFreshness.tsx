import React from 'react';

export const DataFreshness: React.FC = () => {
  return (
    <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '1px' }}>DATA FRESHNESS</div>
      
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {/* Active Source */}
        <div className="status-pill" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div className="status-dot" style={{ background: 'var(--accent-yellow)' }}></div>
          <span style={{ fontWeight: 500 }}>data.gov.in</span>
          <span style={{ color: 'var(--text-secondary)' }}>active</span>
        </div>

        {/* Inactive / Placeholder Sources */}
        <div className="status-pill" style={{ background: 'transparent', opacity: 0.6 }}>
          <div className="status-dot" style={{ background: 'var(--accent-pink)' }}></div>
          <span>Veg Market Price</span>
        </div>
        <div className="status-pill" style={{ background: 'transparent', opacity: 0.6 }}>
          <div className="status-dot" style={{ background: 'var(--accent-blue)' }}></div>
          <span>eNAM</span>
        </div>
        <div className="status-pill" style={{ background: 'transparent', opacity: 0.6 }}>
          <div className="status-dot" style={{ background: 'var(--accent-green)' }}></div>
          <span>Agmarknet</span>
        </div>
        <div className="status-pill" style={{ background: 'transparent', opacity: 0.6 }}>
          <div className="status-dot" style={{ background: 'var(--accent-purple)' }}></div>
          <span>IndiaDataPortal</span>
        </div>
      </div>
    </div>
  );
};
