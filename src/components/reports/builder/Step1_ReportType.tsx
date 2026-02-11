import { Button } from '@/components/ui/button';
import type { DataSource, ReportCategory } from '@/lib/types';

interface ReportTypeOption {
  id: string;
  label: string;
  category: ReportCategory;
  defaultDataSource: DataSource;
}

const OPTIONS: ReportTypeOption[] = [
  { id: 'resident_list', label: 'Resident List', category: 'daily_operations', defaultDataSource: 'census' },
  { id: 'medication', label: 'Medication Report', category: 'stewardship', defaultDataSource: 'abt' },
  { id: 'ip', label: 'Infection Prevention Log', category: 'surveillance', defaultDataSource: 'ip_cases' },
  { id: 'vax', label: 'Vaccination Tracker', category: 'vaccination', defaultDataSource: 'vaccinations' },
  { id: 'custom', label: 'Custom Combined Report', category: 'custom', defaultDataSource: 'notes' },
];

interface Props {
  onSelect: (option: ReportTypeOption) => void;
}

const Step1_ReportType = ({ onSelect }: Props) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((option) => (
        <Button key={option.id} variant="outline" className="h-auto justify-start p-4" onClick={() => onSelect(option)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
};

export default Step1_ReportType;
