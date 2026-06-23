import React from 'react';

interface AgmarknetFiltersProps {
  filters: any;
  filterData: any;
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
  date: string;
  onDateChange: (date: string) => void;
}

export const AgmarknetFilters: React.FC<AgmarknetFiltersProps> = ({
  filters,
  filterData,
  onFilterChange,
  onReset,
  date,
  onDateChange
}) => {
  if (!filterData) return null;

  const states = filterData.state_data || [];
  const districts = filterData.district_data || [];
  const markets = filterData.market_data || [];
  const groups = filterData.group_data || [];
  const cmdts = filterData.cmdt_data || [];
  
  const liveAvailable = filterData.live_available !== false;
  const cachedStateIds = filterData.cached_state_ids || [];

  const filteredDistricts = districts.filter((d: any) => 
    filters.state === 100006 || d.state_id === filters.state
  );

  const filteredMarkets = markets.filter((m: any) => {
    if (m.state_id === null) return true; // All Markets option
    const stateMatch = filters.state === 100006 || m.state_id === filters.state;
    const districtMatch = !filters.district.length || m.district_id === filters.district[0];
    return stateMatch && districtMatch;
  });

  return (
    <div className="filters-bar" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full">
        <select 
          value={filters.state} 
          onChange={(e) => onFilterChange('state', parseInt(e.target.value))}
          className="flex-1 min-w-[120px] bg-white border border-gray-300 text-gray-700 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          {states.map((s: any) => {
            const available = liveAvailable || cachedStateIds.includes(s.state_id);
            return (
              <option key={s.state_id} value={s.state_id} disabled={!available}>
                {s.state_name}{available ? '' : ' (unavailable)'}
              </option>
            );
          })}
        </select>

        <select 
          value={filters.district.length ? filters.district[0] : ''} 
          onChange={(e) => onFilterChange('district', e.target.value ? [parseInt(e.target.value)] : [])}
          className="flex-1 min-w-[120px] bg-white border border-gray-300 text-gray-700 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          disabled={filters.state === 100006}
        >
          <option value="">All Districts</option>
          {filteredDistricts.filter((d: any) => d.id !== 100007).map((d: any) => (
            <option key={d.id} value={d.id}>{d.district_name}</option>
          ))}
        </select>

        <select 
          value={filters.market[0] || 100009} 
          onChange={(e) => onFilterChange('market', [parseInt(e.target.value)])}
          className="flex-1 min-w-[120px] bg-white border border-gray-300 text-gray-700 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          {filteredMarkets.map((m: any) => (
            <option key={m.id} value={m.id}>{m.mkt_name}</option>
          ))}
        </select>

        <select 
          value={filters.group.length ? filters.group[0] : ''} 
          onChange={(e) => onFilterChange('group', e.target.value ? [parseInt(e.target.value)] : [])}
          className="flex-1 min-w-[120px] bg-white border border-gray-300 text-gray-700 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Commodity Groups</option>
          {groups.map((g: any) => (
            <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
          ))}
        </select>

        <select 
          value={filters.commodity.join(',')} 
          onChange={(e) => onFilterChange('commodity', e.target.value.split(',').map(Number))}
          className="flex-1 min-w-[120px] bg-white border border-gray-300 text-gray-700 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="1,2,4">Default (Paddy, Maize, Wheat)</option>
          <option value="100001">All Commodities</option>
          {cmdts.filter((c: any) => c.cmdt_id !== 100001).map((c: any) => (
            <option key={c.cmdt_id} value={c.cmdt_id}>{c.cmdt_name}</option>
          ))}
        </select>

        <select 
          className="flex-1 min-w-[120px] bg-gray-50 border border-gray-300 text-gray-500 text-sm rounded-md px-3 py-2 cursor-not-allowed"
          disabled
        >
          <option>All Varieties</option>
        </select>

        <select 
          className="flex-1 min-w-[120px] bg-gray-50 border border-gray-300 text-gray-500 text-sm rounded-md px-3 py-2 cursor-not-allowed"
          disabled
        >
          <option>FAQ</option>
        </select>

        <button 
          onClick={onReset}
          className="bg-slate-500 hover:bg-slate-600 text-white border-none px-6 py-2 rounded-md cursor-pointer font-medium whitespace-nowrap text-sm transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
