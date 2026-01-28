import { Download, Upload, Shield, Plus, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  surveyorMode: boolean;
  onToggleSurveyorMode: () => void;
  onAddResident: () => void;
  onOpenDataModal?: () => void;
}

const AppHeader = ({ surveyorMode, onToggleSurveyorMode, onAddResident, onOpenDataModal }: AppHeaderProps) => {
  return (
    <header className="app-header sticky top-0 z-50 px-4 py-4">
      <div className="container mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="Healthcare">🧑‍⚕️</span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Infection Control Nurse Hub</h1>
            <p className="text-sm opacity-90">Daily Support Platform for Prevention, Outbreaks, and Compliance</p>
          </div>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold hidden md:inline-block">
            ICN Hub
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDataModal}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <Database className="w-4 h-4 mr-2" />
            Data
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSurveyorMode}
            className={`border-white/20 ${
              surveyorMode
                ? 'bg-amber-500/80 hover:bg-amber-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Shield className="w-4 h-4 mr-2" />
            Surveyor: {surveyorMode ? 'On' : 'Off'}
          </Button>
          <Button
            size="sm"
            onClick={onAddResident}
            className="bg-white text-primary hover:bg-white/90 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Resident
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
