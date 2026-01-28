import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

const SectionCard = ({ 
  title, 
  children, 
  actions, 
  className,
  noPadding = false
}: SectionCardProps) => {
  return (
    <div className={cn('section-card', className)}>
      <div className="section-card-header">
        <h3 className="section-card-title">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={cn(!noPadding && 'section-card-body')}>
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
