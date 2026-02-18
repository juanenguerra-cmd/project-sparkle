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
  Menu,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  BookOpen
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
  { id: 'census', label: 'Census', icon: <Users className="w-5 h-5" /> },
  { id: 'abt', label: 'ABT Management', icon: <Pill className="w-5 h-5" /> },
  { id: 'resident_overview', label: 'Resident Overview', icon: <UserCheck className="w-5 h-5" /> },
  { id: 'ip', label: 'IP Tracker', icon: <ShieldAlert className="w-5 h-5" /> },
  { id: 'vax', label: 'VAX Tracker', icon: <Syringe className="w-5 h-5" /> },
  { id: 'notes', label: 'Notes', icon: <FileText className="w-5 h-5" /> },
  { id: 'outbreak', label: 'Outbreak/Line List', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'staff', label: 'Staff / Employee List', icon: <Users className="w-5 h-5" /> },
  { id: 'reference_library', label: 'Reference Library', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'audit', label: 'Audit Trail', icon: <History className="w-5 h-5" /> },
  { id: 'user_management', label: 'User Management', icon: <Users className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const navSections = [
  {
    label: 'Overview',
    items: ['dashboard', 'resident_overview'],
  },
  {
    label: 'Daily Operations',
    items: ['census', 'ip', 'abt', 'vax', 'notes', 'outbreak', 'staff'],
  },
  {
    label: 'Compliance & Reporting',
    items: ['reference_library', 'reports', 'audit', 'user_management', 'settings'],
  },
];

const quickActions: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'census', label: 'Review Census', icon: <Users className="w-4 h-4" /> },
  { id: 'ip', label: 'Add IP Case', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'abt', label: 'Review ABT', icon: <Pill className="w-4 h-4" /> },
  { id: 'reports', label: 'Run Report', icon: <TrendingUp className="w-4 h-4" /> },
];

const MobileNav = ({ activeView, onViewChange }: MobileNavProps) => {
  const [open, setOpen] = useState(false);

  const handleNavClick = (view: ViewType) => {
    onViewChange(view);
    setOpen(false);
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
      {/* Bottom Tab Bar */}
      <div className="flex justify-around items-center py-1.5 px-1">
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 px-2.5 py-2 rounded-lg transition-colors',
              activeView === item.id
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.icon}
            <span className="text-[11px] leading-tight">{item.label.split(' ')[0]}</span>
          </button>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 h-auto py-2 px-2.5">
              <Menu className="w-5 h-5" />
              <span className="text-[11px] leading-tight">More</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-auto max-h-[85dvh] flex-col overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4"
          >
            <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quickActions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <nav className="space-y-4">
                {navSections.map((section) => (
                  <div key={section.label} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {navItems
                        .filter((item) => section.items.includes(item.id))
                        .map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id)}
                            className={cn(
                              'flex flex-col items-center gap-2 p-3 rounded-xl transition-colors',
                              activeView === item.id
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {item.icon}
                            <span className="text-xs font-medium text-center leading-snug">{item.label}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default MobileNav;
