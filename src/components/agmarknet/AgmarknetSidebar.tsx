import React, { useMemo } from 'react';

interface SidebarProps {
  filters: any;
  filterData: any;
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
  date: string;
  onDateChange: (date: string) => void;
}

export const AgmarknetSidebar: React.FC<SidebarProps> = ({ filters, filterData, onFilterChange, onReset, date, onDateChange }) => {
  if (!filterData) return <div className="sidebar">Loading...</div>;

  const { state_data, market_data, cmdt_data, grade_data } = filterData;

  const filteredMarkets = useMemo(() => {
    if (filters.state === 100006) return market_data || []; // All States
    let m = (market_data || []).filter((x: any) => x.state_id === filters.state);
    if (filters.district && filters.district.length > 0) {
      m = m.filter((x: any) => filters.district.includes(x.district_id));
    }
    return [{ id: 100009, mkt_name: 'All Markets' }, ...m];
  }, [filters.state, filters.district, market_data]);

  const filteredCommodities = useMemo(() => {
    if (!filters.group || filters.group.length === 0) return cmdt_data || [];
    return (cmdt_data || []).filter((x: any) => filters.group.includes(x.cmdt_group_id));
  }, [filters.group, cmdt_data]);

  return (
    <div className="sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '1px' }}>AGMARKNET FILTERS</h3>
        <button className="reset-btn" onClick={onReset}>Reset</button>
      </div>

      <div className="input-group">
        <label>Date</label>
        <input 
          type="date" 
          value={date} 
          onChange={e => onDateChange(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        />
      </div>

      <div className="input-group">
        <label>State</label>
        <select value={filters.state} onChange={e => onFilterChange('state', parseInt(e.target.value))}>
          <option value={100006}>All States</option>
          {state_data?.map((s: any) => <option key={s.state_id} value={s.state_id}>{s.state_name}</option>)}
        </select>
      </div>

      <div className="input-group">
        <label>Market / Mandi</label>
        <select value={filters.market[0]} onChange={e => onFilterChange('market', [parseInt(e.target.value)])}>
          {filteredMarkets?.map((m: any) => <option key={m.id} value={m.id}>{m.mkt_name}</option>)}
        </select>
      </div>

      <div className="input-group">
        <label>Commodity</label>
        <select value={filters.commodity[0]} onChange={e => onFilterChange('commodity', [parseInt(e.target.value)])}>
          {filteredCommodities?.map((c: any) => <option key={c.cmdt_id} value={c.cmdt_id}>{c.cmdt_name}</option>)}
        </select>
      </div>

      <div className="input-group">
        <label>Grade</label>
        <select value={filters.grades[0]} onChange={e => onFilterChange('grades', [parseInt(e.target.value)])}>
          {grade_data?.map((g: any) => <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>)}
        </select>
      </div>

      <div style={{ marginTop: '16px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'block' }}>Quick select commodities</label>
        <div className="pill-container">
           <button className={`pill ${filters.commodity.includes(1) ? 'active' : ''}`} onClick={() => onFilterChange('commodity', [1,2,4])}>Wheat, Paddy, Maize</button>
           <button className={`pill ${filters.commodity.includes(12) ? 'active' : ''}`} onClick={() => onFilterChange('commodity', [12])}>Mustard</button>
           <button className={`pill ${filters.commodity.includes(23) ? 'active' : ''}`} onClick={() => onFilterChange('commodity', [23])}>Onion</button>
        </div>
      </div>
    </div>
  );
};
