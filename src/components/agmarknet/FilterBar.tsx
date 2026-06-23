import React from 'react';

interface FilterBarProps {
  commodity: string;
  state: string;
  district: string;
  onFilterChange: (key: string, value: string) => void;
  isLoading: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ commodity, state, district, onFilterChange, isLoading }) => {
  const commonCommodities = ['Wheat', 'Potato', 'Onion', 'Rice', 'Tomato', 'Apple', 'Banana', 'Cotton'];

  return (
    <div className="glass-panel" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Commodity
        </label>
        <select 
          value={commodity} 
          onChange={(e) => onFilterChange('commodity', e.target.value)}
          style={{ width: '100%' }}
          disabled={isLoading}
        >
          {commonCommodities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, minWidth: '200px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          State
        </label>
        <input 
          type="text" 
          value={state}
          onChange={(e) => onFilterChange('state', e.target.value)}
          placeholder="e.g. Maharashtra"
          style={{ width: '100%' }}
          disabled={isLoading}
        />
      </div>

      <div style={{ flex: 1, minWidth: '200px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          District
        </label>
        <input 
          type="text" 
          value={district}
          onChange={(e) => onFilterChange('district', e.target.value)}
          placeholder="e.g. Pune"
          style={{ width: '100%' }}
          disabled={isLoading}
        />
      </div>
      
      {isLoading && (
        <div style={{ fontSize: '14px', color: 'var(--accent-color)', padding: '10px' }}>
          Loading...
        </div>
      )}
    </div>
  );
};
