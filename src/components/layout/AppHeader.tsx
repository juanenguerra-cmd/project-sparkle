import { Download, Upload, Shield, Plus, Database, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AppHeaderProps {
  surveyorMode: boolean;
  onToggleSurveyorMode: () => void;
  onAddResident: () => void;
  onOpenDataModal?: () => void;
}

const AppHeader = ({ surveyorMode, onToggleSurveyorMode, onAddResident, onOpenDataModal }: AppHeaderProps) => {
  return (
    <header className="app-header sticky top-0 z-50 px-4 py-3 md:py-4">
      <div className="container mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" role="img" aria-label="Healthcare">🧑‍⚕️</span>
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight">Infection Control Nurse Hub</h1>
            <p className="text-xs sm:text-sm opacity-90 hidden sm:block">
              Daily Support Platform for Prevention, Outbreaks, and Compliance
            </p>
          </div>
          <span className="bg-white/20 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold hidden sm:inline-flex">
            ICN Hub
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:justify-end">
          <NotificationCenter />
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-50">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden="true" />
            <span>DB Sync: Updated</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDataModal}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 px-2.5"
          >
            <Database className="w-4 h-4 mr-1.5" />
            <span className="text-xs sm:text-sm">Data</span>
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleSurveyorMode}
                  className={`border-white/20 px-2.5 ${
                    surveyorMode
                      ? 'bg-amber-500/80 hover:bg-amber-500 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <Shield className="w-4 h-4 mr-1.5" />
                  <span className="text-xs sm:text-sm">
                    <span className="hidden sm:inline">Surveyor:</span> {surveyorMode ? 'On' : 'Off'}
                  </span>
                  <Info className="w-4 h-4 ml-1.5 opacity-80 hidden sm:inline" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Enable Surveyor Mode for a compliance-focused experience and streamlined surveyor-ready reporting.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            onClick={onAddResident}
            className="bg-white text-primary hover:bg-white/90 font-semibold px-2.5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="text-xs sm:text-sm">Add Resident</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
