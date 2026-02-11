import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ColumnDefinition, CustomReportTemplate, DataSource } from '@/lib/types';

interface AvailableColumn {
  id: string;
  name: string;
  type: ColumnDefinition['dataType'];
  required?: boolean;
  transform?: ColumnDefinition['transform'];
}

const DATA_SOURCE_COLUMNS: Record<DataSource, AvailableColumn[]> = {
  census: [
    { id: 'mrn', name: 'MRN', type: 'text', required: true },
    { id: 'name', name: 'Resident Name', type: 'text', required: true },
    { id: 'room', name: 'Room', type: 'text' },
    { id: 'unit', name: 'Unit', type: 'text' },
    { id: 'dob', name: 'Date of Birth', type: 'date' },
  ],
  abt: [
    { id: 'residentName', name: 'Resident', type: 'text', required: true },
    { id: 'medication', name: 'Medication', type: 'text', required: true },
    { id: 'startDate', name: 'Start Date', type: 'date' },
  ],
  ip_cases: [
    { id: 'residentName', name: 'Resident', type: 'text', required: true },
    { id: 'protocol', name: 'Protocol', type: 'status', required: true },
    { id: 'onsetDate', name: 'Onset Date', type: 'date' },
  ],
  vaccinations: [
    { id: 'residentName', name: 'Resident', type: 'text', required: true },
    { id: 'vaccine', name: 'Vaccine Type', type: 'text' },
    { id: 'status', name: 'Status', type: 'status' },
  ],
  notes: [
    { id: 'residentName', name: 'Resident', type: 'text', required: true },
    { id: 'category', name: 'Note Type', type: 'text' },
    { id: 'createdAt', name: 'Note Date', type: 'date' },
  ],
};

interface Props {
  template: Partial<CustomReportTemplate>;
  onUpdate: (columns: ColumnDefinition[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const Step3_ColumnSelector = ({ template, onUpdate, onNext, onBack }: Props) => {
  const [selectedColumns, setSelectedColumns] = useState<ColumnDefinition[]>(template.selectedColumns || []);
  const [searchTerm, setSearchTerm] = useState('');

  const availableColumns = useMemo(
    () => DATA_SOURCE_COLUMNS[(template.dataSource || 'census') as DataSource],
    [template.dataSource]
  );

  const filteredColumns = availableColumns.filter((column) =>
    column.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateColumns = (columns: ColumnDefinition[]) => {
    const normalized = columns.map((column, index) => ({ ...column, position: index }));
    setSelectedColumns(normalized);
    onUpdate(normalized);
  };

  const addColumn = (column: AvailableColumn) => {
    if (selectedColumns.some((selected) => selected.id === column.id)) return;
    updateColumns([
      ...selectedColumns,
      {
        id: column.id,
        fieldPath: column.id,
        displayName: column.name,
        dataType: column.type,
        position: selectedColumns.length,
        required: column.required,
        transform: column.transform,
      },
    ]);
  };

  const removeColumn = (id: string) => updateColumns(selectedColumns.filter((column) => column.id !== id));

  const moveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedColumns.length) return;
    const reordered = [...selectedColumns];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);
    updateColumns(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4" style={{ height: '500px' }}>
        <div className="border rounded-lg p-4 flex flex-col">
          <h3 className="font-bold mb-3">Available Fields</h3>
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="mb-3 px-3 py-2 border rounded"
          />
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredColumns.map((column) => (
              <button key={column.id} type="button" className="w-full p-2 bg-gray-50 rounded hover:bg-blue-50 border text-left" onClick={() => addColumn(column)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{column.name}</span>
                  <Plus className="w-4 h-4 text-blue-500" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4 flex flex-col">
          <h3 className="font-bold mb-3">Selected Fields ({selectedColumns.length})</h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {selectedColumns.map((column, index) => (
              <div key={column.id} className="p-3 bg-white border rounded-lg flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{column.displayName}</span>
                <button type="button" onClick={() => moveColumn(index, -1)}><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => moveColumn(index, 1)}><ArrowDown className="w-4 h-4" /></button>
                {!column.required && (
                  <button type="button" onClick={() => removeColumn(column.id)}><X className="w-4 h-4 text-red-500" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} disabled={selectedColumns.length === 0}>Next: Preview & Save →</Button>
      </div>
    </div>
  );
};

export default Step3_ColumnSelector;
