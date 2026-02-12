import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CustomReportTemplate, DataSource } from '@/lib/types';

interface Props {
  template: Partial<CustomReportTemplate>;
  onUpdate: (updates: Partial<CustomReportTemplate>) => void;
  onNext: () => void;
  onBack: () => void;
}

const Step2_DataSource = ({ template, onUpdate, onNext, onBack }: Props) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Primary Data Source</label>
        <Select
          value={template.dataSource || 'census'}
          onValueChange={(value) => onUpdate({ dataSource: value as DataSource })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select data source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="census">Census</SelectItem>
            <SelectItem value="abt">ABT</SelectItem>
            <SelectItem value="ip_cases">IP Cases</SelectItem>
            <SelectItem value="vaccinations">Vaccinations</SelectItem>
            <SelectItem value="notes">Notes</SelectItem>
            <SelectItem value="line_listings">Line Listings</SelectItem>
            <SelectItem value="outbreaks">Outbreaks</SelectItem>
            <SelectItem value="contacts">Contact Tracing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Next: Columns →</Button>
      </div>
    </div>
  );
};

export default Step2_DataSource;
