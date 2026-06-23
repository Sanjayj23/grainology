import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  filters: any;
  filterData: any;
}

export const DataGovTrendChart: React.FC<TrendChartProps> = ({ filters, filterData }) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { stateName, commodityName } = useMemo(() => {
    let stateName = '';
    let commodityName = '';

    if (filterData && filters) {
      if (filters.state && filters.state !== 100006) {
        const s = filterData.state_data?.find((x: any) => x.state_id === filters.state);
        if (s) stateName = s.state_name;
      }
      if (filters.commodity && filters.commodity.length > 0 && filters.commodity[0] !== 100001) {
        const c = filterData.cmdt_data?.find((x: any) => x.cmdt_id === filters.commodity[0]);
        if (c) commodityName = c.cmdt_name;
      }
    }
    return { stateName, commodityName };
  }, [filters, filterData]);

  useEffect(() => {
    const fetchTrend = async () => {
      setIsLoading(true);
      try {
        let url = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&limit=2000';
        
        if (stateName) url += `&filters[state]=${encodeURIComponent(stateName)}`;
        if (commodityName) url += `&filters[commodity]=${encodeURIComponent(commodityName)}`;

        const res = await fetch(url);
        const json = await res.json();
        
        if (json.records) {
          // Group by date and calculate average modal_price
          const grouped: Record<string, { sum: number; count: number }> = {};
          
          json.records.forEach((r: any) => {
            const dateParts = r.arrival_date.split('/'); // DD/MM/YYYY
            if (dateParts.length === 3) {
              const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
              const price = parseFloat(r.modal_price);
              if (!isNaN(price)) {
                if (!grouped[isoDate]) grouped[isoDate] = { sum: 0, count: 0 };
                grouped[isoDate].sum += price;
                grouped[isoDate].count += 1;
              }
            }
          });

          const chartData = Object.keys(grouped).map(date => ({
            date,
            price: Math.round(grouped[date].sum / grouped[date].count),
            displayDate: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          })).sort((a, b) => a.date.localeCompare(b.date));

          // Take last 14 days
          setData(chartData.slice(-14));
        }
      } catch (e) {
        console.error("Error fetching trend data", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrend();
  }, [stateName, commodityName]);

  if (!filterData) return null;

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            2-Week Price Trend (Data.gov.in)
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            {commodityName || 'All Commodities'} • {stateName || 'All States'}
          </p>
        </div>
      </div>

      <div style={{ height: '300px', width: '100%' }}>
        {isLoading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Loading trend data...
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
              <XAxis dataKey="displayDate" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
              <Tooltip 
                contentStyle={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                itemStyle={{ color: 'var(--accent-green)', fontWeight: 600 }}
                formatter={(value: number) => [`₹${value}`, 'Avg Price']}
                labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey="price" stroke="var(--accent-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            No trend data available for these filters.
          </div>
        )}
      </div>
    </div>
  );
};
