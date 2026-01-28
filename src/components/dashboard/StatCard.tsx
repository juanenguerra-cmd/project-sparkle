import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: ReactNode;
  iconVariant?: 'blue' | 'red' | 'amber' | 'green' | 'purple';
  value: string | number;
  label: string;
  change?: {
    value: string;
    positive: boolean;
  };
  onClick?: () => void;
}

const StatCard = ({ 
  icon, 
  iconVariant = 'blue', 
  value, 
  label, 
  change,
  onClick 
}: StatCardProps) => {
  const iconClasses = {
    blue: 'stat-icon-blue',
    red: 'stat-icon-red',
    amber: 'stat-icon-amber',
    green: 'stat-icon-green',
    purple: 'stat-icon-purple',
  };

  return (
    <div 
      className={cn(
        'stat-card',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('stat-icon', iconClasses[iconVariant])}>
          {icon}
        </div>
        {change && (
          <span 
            className={cn(
              'text-sm font-semibold flex items-center gap-1',
              change.positive ? 'text-success' : 'text-destructive'
            )}
          >
            {change.positive ? '↑' : '↓'} {change.value}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
};

export default StatCard;
