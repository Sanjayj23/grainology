import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, trend }) => {
  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</h3>
        <div style={{ 
          background: 'rgba(99, 102, 241, 0.1)', 
          padding: '8px', 
          borderRadius: '8px',
          color: 'var(--accent-color)'
        }}>
          <Icon size={20} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ 
            fontSize: '12px', 
            marginTop: '4px',
            color: trend === 'up' ? 'var(--success-color)' : trend === 'down' ? 'var(--danger-color)' : 'var(--text-secondary)' 
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
