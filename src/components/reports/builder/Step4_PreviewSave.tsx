import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CustomReportTemplate } from '@/lib/types';

interface Props {
  template: CustomReportTemplate;
  onSave: (template: CustomReportTemplate) => void;
  onBack: () => void;
}

const Step4_PreviewSave = ({ template, onSave, onBack }: Props) => {
  const [name, setName] = useState(template.name || 'Custom Report');

  const finalized = useMemo<CustomReportTemplate>(() => ({
    ...template,
    id: template.id || crypto.randomUUID(),
    name,
    createdAt: template.createdAt || new Date().toISOString(),
    filters: template.filters || {},
    selectedColumns: template.selectedColumns || [],
    layout: template.layout || { orientation: 'portrait', pageSize: 'letter', fontSize: 'normal' },
    category: template.category || 'custom',
    dataSource: template.dataSource || 'census',
  }), [name, template]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Template name</label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="rounded border p-3 text-sm">
        <div>Data source: {finalized.dataSource}</div>
        <div>Columns: {finalized.selectedColumns.length}</div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={() => onSave(finalized)}>Save Template</Button>
      </div>
    </div>
  );
};

export default Step4_PreviewSave;
