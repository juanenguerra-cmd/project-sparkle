import { 
  LayoutDashboard, 
  Pill, 
  Users, 
  UserCheck,
  ShieldAlert, 
  Syringe, 
  FileText, 
  BarChart3, 
  History, 
  Settings,
  AlertTriangle
} from 'lucide-react';
import { ViewType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'abt', label: 'ABT Management', icon: <Pill className="w-5 h-5" /> },
  { id: 'census', label: 'Census', icon: <Users className="w-5 h-5" /> },
  { id: 'resident_overview', label: 'Resident Overview', icon: <UserCheck className="w-5 h-5" /> },
  { id: 'ip', label: 'IP Tracker', icon: <ShieldAlert className="w-5 h-5" /> },
  { id: 'vax', label: 'VAX Tracker', icon: <Syringe className="w-5 h-5" /> },
  { id: 'notes', label: 'Notes & Symptoms', icon: <FileText className="w-5 h-5" /> },
  { id: 'outbreak', label: 'Outbreak/Line List', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'audit', label: 'Audit Trail', icon: <History className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  return (
    <aside className="w-60 bg-sidebar border-r border-sidebar-border flex-shrink-0 hidden lg:block">
      <nav className="p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'nav-item w-full',
              activeView === item.id && 'active'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
