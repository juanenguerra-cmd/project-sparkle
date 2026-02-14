import { useMemo, useRef, useState } from 'react';
import { FileDown, Printer, Upload } from 'lucide-react';
import SectionCard from '@/components/dashboard/SectionCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ReviewRow {
  department: string;
  staff: string;
  module: string;
  moduleStatus: string;
  checklist: string;
  checklistStatus: string;
}

interface DepartmentSummary {
  department: string;
  staffCount: number;
  completedStaffCount: number;
  incompleteStaffCount: number;
}

const normalize = (value: string | undefined): string => (value || '').trim();

const isComplete = (value: string): boolean => {
  const v = value.toLowerCase();
  return v === 'complete' || v === 'completed' || v === 'done' || v === 'pass' || v === 'passed';
};

const parseCSV = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current);
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some(cell => cell.trim() !== '')) rows.push(row);

  return rows;
};

const MasteredITReviewPanel = () => {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedChecklists, setSelectedChecklists] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const content = await file.text();
    const parsed = parseCSV(content);
    if (parsed.length < 2) {
      setRows([]);
      return;
    }

    const header = parsed[0].map(h => h.trim().toLowerCase());
    const indexOf = (...keys: string[]) => header.findIndex(h => keys.includes(h));

    const departmentIdx = indexOf('department', 'dept');
    const staffIdx = indexOf('staff', 'staff_name', 'name', 'employee');
    const moduleIdx = indexOf('module', 'course', 'module_name', 'course_name');
    const moduleStatusIdx = indexOf('module_status', 'status', 'completion_status', 'course_status');
    const checklistIdx = indexOf('checklist', 'checklist_name');
    const checklistStatusIdx = indexOf('checklist_status', 'checklist_completion', 'check_status');

    const mapped: ReviewRow[] = parsed.slice(1).map(cols => ({
      department: normalize(cols[departmentIdx]) || 'Unknown Department',
      staff: normalize(cols[staffIdx]) || 'Unknown Staff',
      module: normalize(cols[moduleIdx]),
      moduleStatus: normalize(cols[moduleStatusIdx]),
      checklist: normalize(cols[checklistIdx]),
      checklistStatus: normalize(cols[checklistStatusIdx]),
    }));

    setRows(mapped);
  };

  const departments = useMemo(() => [...new Set(rows.map(r => r.department))].sort(), [rows]);

  const departmentSummaries = useMemo<DepartmentSummary[]>(() => {
    return departments.map(department => {
      const byDept = rows.filter(r => r.department === department);
      const byStaff = new Map<string, ReviewRow[]>();
      byDept.forEach(r => {
        const existing = byStaff.get(r.staff) || [];
        existing.push(r);
        byStaff.set(r.staff, existing);
      });

      let completedStaffCount = 0;
      let incompleteStaffCount = 0;

      byStaff.forEach(staffRows => {
        const moduleRows = staffRows.filter(r => r.module);
        const isCompleted = moduleRows.length > 0 && moduleRows.every(r => isComplete(r.moduleStatus));
        if (isCompleted) completedStaffCount += 1;
        else incompleteStaffCount += 1;
      });

      return {
        department,
        staffCount: byStaff.size,
        completedStaffCount,
        incompleteStaffCount,
      };
    });
  }, [departments, rows]);

  const selectedDepartmentRows = useMemo(() => {
    if (selectedDepartment === 'all') return rows;
    return rows.filter(r => r.department === selectedDepartment);
  }, [rows, selectedDepartment]);

  const departmentStaffDrilldown = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>();
    selectedDepartmentRows.forEach(r => {
      const existing = grouped.get(r.staff) || [];
      existing.push(r);
      grouped.set(r.staff, existing);
    });

    return [...grouped.entries()].map(([staff, staffRows]) => {
      const modules = staffRows.filter(r => r.module);
      const completeCount = modules.filter(m => isComplete(m.moduleStatus)).length;
      const pendingCount = modules.length - completeCount;
      return {
        staff,
        completeCount,
        pendingCount,
        status: pendingCount === 0 && modules.length > 0 ? 'Completed' : 'Incomplete/Pending',
      };
    }).sort((a, b) => a.staff.localeCompare(b.staff));
  }, [selectedDepartmentRows]);

  const checklistOptions = useMemo(() => {
    return [...new Set(rows.map(r => r.checklist).filter(Boolean))].sort();
  }, [rows]);

  const checklistDrilldownRows = useMemo(() => {
    if (selectedChecklists.length === 0) return [];
    return rows.filter(r => selectedChecklists.includes(r.checklist));
  }, [rows, selectedChecklists]);

  const exportFilteredReport = () => {
    const lines = [
      'section,department,staff,module,module_status,checklist,checklist_status',
      ...checklistDrilldownRows.map(r => [
        'checklist_completion',
        r.department,
        r.staff,
        r.module,
        r.moduleStatus,
        r.checklist,
        r.checklistStatus,
      ].map(v => `"${(v || '').replaceAll('"', '""')}"`).join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mastered-it-review-filtered-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const printFiltered = () => {
    const w = window.open('', '_blank', 'width=1100,height=850');
    if (!w) return;

    const rowsHtml = checklistDrilldownRows
      .map(r => `<tr><td>${r.department}</td><td>${r.staff}</td><td>${r.checklist}</td><td>${r.checklistStatus || 'Pending'}</td></tr>`)
      .join('');

    w.document.write(`
      <html>
        <head>
          <title>Mastered IT Review - Filtered Checklist Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h2>Mastered IT Review - Filtered Checklist Completion</h2>
          <p>Items: ${checklistDrilldownRows.length}</p>
          <table>
            <thead><tr><th>Department</th><th>Staff</th><th>Checklist</th><th>Status</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <SectionCard title="Mastered IT Review">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.currentTarget.value = '';
            }}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Mastered IT Review Import
          </Button>
          <Button variant="outline" onClick={printFiltered} disabled={checklistDrilldownRows.length === 0}>
            <Printer className="w-4 h-4 mr-2" />
            Print Filtered Report
          </Button>
          <Button variant="outline" onClick={exportFilteredReport} disabled={checklistDrilldownRows.length === 0}>
            <FileDown className="w-4 h-4 mr-2" />
            Export Filtered CSV
          </Button>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Course Completion Review</h3>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">Department</th>
                  <th className="text-left p-2">Staff Count</th>
                  <th className="text-left p-2">Completed Staff</th>
                  <th className="text-left p-2">Incomplete/Pending Staff</th>
                </tr>
              </thead>
              <tbody>
                {departmentSummaries.map(item => (
                  <tr key={item.department} className="border-t">
                    <td className="p-2">
                      <button className="underline" onClick={() => setSelectedDepartment(item.department)}>
                        {item.department}
                      </button>
                    </td>
                    <td className="p-2">{item.staffCount}</td>
                    <td className="p-2">{item.completedStaffCount}</td>
                    <td className="p-2">{item.incompleteStaffCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Drill down by clicking a department name.
          </p>

          <div className="mt-3 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">Staff</th>
                  <th className="text-left p-2">Completed Modules</th>
                  <th className="text-left p-2">Incomplete/Pending Modules</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {departmentStaffDrilldown.map(item => (
                  <tr key={item.staff} className="border-t">
                    <td className="p-2">{item.staff}</td>
                    <td className="p-2">{item.completeCount}</td>
                    <td className="p-2">{item.pendingCount}</td>
                    <td className="p-2">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Checklist Completion Report</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-3">
            {checklistOptions.map(item => {
              const checked = selectedChecklists.includes(item);
              return (
                <label key={item} className="flex items-center gap-2 text-sm rounded border p-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      const isChecked = value === true;
                      setSelectedChecklists(prev => isChecked ? [...prev, item] : prev.filter(v => v !== item));
                    }}
                  />
                  <span>{item}</span>
                </label>
              );
            })}
          </div>

          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">Department</th>
                  <th className="text-left p-2">Staff</th>
                  <th className="text-left p-2">Checklist</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {checklistDrilldownRows.map((row, index) => (
                  <tr key={`${row.staff}-${row.checklist}-${index}`} className="border-t">
                    <td className="p-2">{row.department}</td>
                    <td className="p-2">{row.staff}</td>
                    <td className="p-2">{row.checklist}</td>
                    <td className="p-2">{row.checklistStatus || 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

export default MasteredITReviewPanel;
