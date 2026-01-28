import { 
  LayoutDashboard, 
  Pill, 
  Users, 
  ShieldAlert, 
  Syringe, 
  FileText, 
  BarChart3, 
  History, 
  Settings,
  Menu
} from 'lucide-react';
import { ViewType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface MobileNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'abt', label: 'ABT Management', icon: <Pill className="w-5 h-5" /> },
  { id: 'census', label: 'Census', icon: <Users className="w-5 h-5" /> },
  { id: 'ip', label: 'IP Tracker', icon: <ShieldAlert className="w-5 h-5" /> },
  { id: 'vax', label: 'VAX Tracker', icon: <Syringe className="w-5 h-5" /> },
  { id: 'notes', label: 'Notes', icon: <FileText className="w-5 h-5" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'audit', label: 'Audit Trail', icon: <History className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const MobileNav = ({ activeView, onViewChange }: MobileNavProps) => {
  const [open, setOpen] = useState(false);

  const handleNavClick = (view: ViewType) => {
    onViewChange(view);
    setOpen(false);
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      {/* Bottom Tab Bar */}
      <div className="flex justify-around items-center py-2 px-1">
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
              activeView === item.id
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.icon}
            <span className="text-xs">{item.label.split(' ')[0]}</span>
          </button>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 h-auto py-2">
              <Menu className="w-5 h-5" />
              <span className="text-xs">More</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh]">
            <nav className="grid grid-cols-3 gap-2 pt-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl transition-colors',
                    activeView === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default MobileNav;
