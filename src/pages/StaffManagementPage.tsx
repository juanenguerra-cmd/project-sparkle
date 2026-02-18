import React, { useEffect, useMemo, useState } from 'react';
import { convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';
import { getAllStaff, saveStaffList, upsertStaff } from '@/lib/stores/staffStore';
import { importStaffFromCSVRows, type RawStaffRow } from '@/lib/utils/staffImport';
import type { ComplianceBinaryStatus, FaceFitStatus, StaffMember, StaffRole } from '@/lib/types/staff';

const ROLE_OPTIONS: { value: StaffRole | 'Other'; label: string }[] = [
  { value: 'RN', label: 'RN' },
  { value: 'LPN', label: 'LPN' },
  { value: 'CNA', label: 'CNA' },
  { value: 'MD', label: 'Physician (MD)' },
  { value: 'NP', label: 'Nurse Practitioner' },
  { value: 'PA', label: 'Physician Assistant' },
  { value: 'Therapy', label: 'Therapy' },
  { value: 'EVS', label: 'EVS / Housekeeping' },
  { value: 'Admin', label: 'Administration' },
  { value: 'Other', label: 'Other' },
];

const DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'Nursing', label: 'Nursing' },
  { value: 'Rehab', label: 'Rehab / Therapy' },
  { value: 'EVS', label: 'EVS / Housekeeping' },
  { value: 'Dietary', label: 'Dietary' },
  { value: 'Activities', label: 'Activities' },
  { value: 'Administration', label: 'Administration' },
  { value: 'Other', label: 'Other' },
];

type SeasonalState = 'current' | 'outdated' | 'missing' | 'declined';
type SortDirection = 'asc' | 'desc';
type SortField = 'fullName' | 'employeeId' | 'role' | 'status' | 'department' | 'hireDate' | 'updatedAt';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'fullName', label: 'Name' },
  { value: 'employeeId', label: 'Employee ID' },
  { value: 'role', label: 'Role' },
  { value: 'status', label: 'Status' },
  { value: 'department', label: 'Department' },
  { value: 'hireDate', label: 'Date hired' },
  { value: 'updatedAt', label: 'Updated' },
];

function seasonBounds(today = new Date()): { start: Date; end: Date } {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  // Season runs Sep 1 -> Aug 31.
  // If today is Sep-Dec, season starts current year Sep 1, ends next year Aug 31.
  // If today is Jan-Aug, season starts previous year Sep 1, ends current year Aug 31.
  const startYear = month >= 8 ? year : year - 1;
  const endYear = month >= 8 ? year + 1 : year;
  const start = new Date(Date.UTC(startYear, 8, 1));
  const end = new Date(Date.UTC(endYear, 7, 31, 23, 59, 59, 999));
  return { start, end };
}

function parseISODateOnly(value?: string): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function seasonalStatus(status?: ComplianceBinaryStatus, date?: string): SeasonalState {
  if (status === 'declined') return 'declined';
  if (status !== 'vaccinated') return 'missing';
  const d = parseISODateOnly(date);
  if (!d) return 'missing';
  const { start, end } = seasonBounds();
  return d >= start && d <= end ? 'current' : 'outdated';
}

function stateBadge(state: SeasonalState) {
  const base = 'inline-flex items-center rounded px-2 py-0.5 text-xs capitalize';
  if (state === 'current') return <span className={`${base} bg-green-100 text-green-800`}>Current</span>;
  if (state === 'outdated') return <span className={`${base} bg-amber-100 text-amber-800`}>Outdated</span>;
  if (state === 'declined') return <span className={`${base} bg-slate-200 text-slate-700`}>Declined</span>;
  return <span className={`${base} bg-red-100 text-red-800`}>Missing</span>;
}

export function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>(() => getAllStaff());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const roleOptions = useMemo(() => {
    const options = new Set<string>();
    staff.forEach((member) => {
      if (member.role) {
        options.add(String(member.role));
      }
    });
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [staff]);

  const statusOptions = useMemo(() => {
    const options = new Set<string>();
    staff.forEach((member) => {
      if (member.status) {
        options.add(String(member.status));
      }
    });
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [staff]);

  const deptOptions = useMemo(() => {
    const options = new Set<string>();
    staff.forEach((member) => {
      const department = member.department?.trim();
      if (department) {
        options.add(department);
      }
    });
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [staff]);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return staff.filter((member) => {
      if (roleFilter !== 'all' && String(member.role ?? '') !== roleFilter) {
        return false;
      }
      if (statusFilter !== 'all' && String(member.status ?? '') !== statusFilter) {
        return false;
      }
      if (deptFilter !== 'all' && String(member.department ?? '').trim() !== deptFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }

      const influenzaState = seasonalStatus(member.influenzaStatus, member.influenzaDate);
      const covidState = seasonalStatus(member.covidStatus, member.covidDate);
      const searchableFields = [
        member.employeeId,
        member.firstName,
        member.lastName,
        member.fullName,
        member.role,
        member.department,
        member.empType,
        member.status,
        member.hireDate,
        member.center,
        member.notes,
        member.faceFitTestStatus,
        member.faceFitTestDate,
        member.influenzaStatus,
        member.influenzaDate,
        member.pneumoniaStatus,
        member.pneumoniaDate,
        member.covidStatus,
        member.covidDate,
        influenzaState,
        covidState,
      ];

      return searchableFields.some((value) => String(value ?? '').toLowerCase().includes(needle));
    });
  }, [staff, searchTerm, roleFilter, statusFilter, deptFilter]);

  const sorted = useMemo(() => {
    const data = filtered.map((member, index) => ({ member, index }));
    const direction = sortDir === 'asc' ? 1 : -1;

    const compareStrings = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const getDateTimestamp = (value?: string) => {
      if (!value) return 0;
      const isoDate = parseISODateOnly(value);
      if (isoDate) return isoDate.getTime();
      const dateTime = new Date(value).getTime();
      return Number.isNaN(dateTime) ? 0 : dateTime;
    };

    data.sort((left, right) => {
      const a = left.member;
      const b = right.member;
      let comparison = 0;

      if (sortField === 'hireDate') {
        comparison = getDateTimestamp(a.hireDate) - getDateTimestamp(b.hireDate);
      } else if (sortField === 'updatedAt') {
        comparison = getDateTimestamp(a.updatedAt) - getDateTimestamp(b.updatedAt);
      } else {
        comparison = compareStrings(String(a[sortField] ?? ''), String(b[sortField] ?? ''));
      }

      if (comparison !== 0) {
        return comparison * direction;
      }

      return left.index - right.index;
    });

    return data.map(({ member }) => member);
  }, [filtered, sortField, sortDir]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text) as RawStaffRow[];
    const result = importStaffFromCSVRows(rows);
    if (result) {
      setStaff(getAllStaff());
      alert(`Import complete.\nNew: ${result.newCount}\nSkipped existing: ${result.skippedExistingCount}`);
    }
    e.target.value = '';
  };

  const handleExport = () => {
    const columns = [
      'employeeId',
      'fullName',
      'role',
      'department',
      'empType',
      'status',
      'hireDate',
      'faceFitTestStatus',
      'faceFitTestDate',
      'influenzaStatus',
      'influenzaDate',
      'pneumoniaStatus',
      'pneumoniaDate',
      'covidStatus',
      'covidDate',
      'notes',
    ];
    const csv = convertToCSV(staff as unknown as Array<Record<string, unknown>>, columns);
    downloadCSV(csv, 'staff-directory.csv');
  };

  const handleSaveEdit = (updated: StaffMember) => {
    upsertStaff(updated);
    setStaff(getAllStaff());
    setEditingStaff(null);
  };

  const activeCount = useMemo(() => staff.filter((member) => member.status !== 'inactive').length, [staff]);
  const inactiveCount = staff.length - activeCount;
  const totalPages = Math.ceil(sorted.length / itemsPerPage);

  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sorted.slice(startIndex, endIndex);
  }, [sorted, currentPage, itemsPerPage]);

  const printSummary = `Filters: [search='${searchTerm || 'All'}', role='${roleFilter === 'all' ? 'All' : roleFilter}', status='${statusFilter === 'all' ? 'All' : statusFilter}', dept='${deptFilter === 'all' ? 'All' : deptFilter}'] | Sort: [${SORT_FIELD_OPTIONS.find((option) => option.value === sortField)?.label ?? sortField}, ${sortDir.toUpperCase()}] | Count: ${sorted.length}`;

  const handlePrintFiltered = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
    if (!printWindow) {
      return;
    }

    const now = new Date();
    const printedAt = now.toLocaleString();
    const rowsHtml = sorted
      .map((member) => {
        const cells = [
          member.fullName,
          member.role,
          member.department,
          member.empType,
          member.hireDate,
          member.status,
          member.faceFitTestStatus,
          member.faceFitTestDate,
          member.influenzaStatus,
          member.influenzaDate,
          member.pneumoniaStatus,
          member.pneumoniaDate,
          member.covidStatus,
          member.covidDate,
          member.notes,
        ]
          .map((value) => `<td>${String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</td>`)
          .join('');

        return `<tr>${cells}</tr>`;
      })
      .join('');

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Staff Directory (Filtered)</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 22px; }
      p { margin: 4px 0 12px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; }
      @media print {
        body { margin: 12mm; }
      }
    </style>
  </head>
  <body>
    <h1>Staff Directory (Filtered)</h1>
    <p>Printed: ${printedAt}</p>
    <p>${printSummary.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Position</th>
          <th>Department</th>
          <th>Emp Type</th>
          <th>Date Hired</th>
          <th>Status</th>
          <th>Face Fit Test</th>
          <th>Face Fit Date</th>
          <th>Influenza</th>
          <th>Influenza Date</th>
          <th>Pneumonia</th>
          <th>Pneumonia Date</th>
          <th>Covid-19</th>
          <th>Covid-19 Date</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  useEffect(() => {
    if (currentPage > (totalPages || 1)) {
      setCurrentPage(totalPages || 1);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff / Employee</h1>
        <div className="flex gap-2">
          <button className="nav-item" onClick={handleExport}>Export (CSV)</button>
          <label className="nav-item cursor-pointer">
            Import Staff Listing (CSV)
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded border bg-muted/20 p-3">
        <label className="flex min-w-[230px] flex-1 flex-col gap-1 text-sm text-muted-foreground">
          Search
          <input
            type="search"
            placeholder="Search by name, email, role, department..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border px-3 py-2 text-foreground"
          />
        </label>

        <label className="flex min-w-[140px] flex-col gap-1 text-sm text-muted-foreground">
          Role
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border px-2 py-2 text-foreground"
          >
            <option value="all">All</option>
            {roleOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[140px] flex-col gap-1 text-sm text-muted-foreground">
          Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border px-2 py-2 text-foreground"
          >
            <option value="all">All</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[170px] flex-col gap-1 text-sm text-muted-foreground">
          Department
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border px-2 py-2 text-foreground"
            disabled={deptOptions.length === 0}
          >
            <option value="all">All</option>
            {deptOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[170px] flex-col gap-1 text-sm text-muted-foreground">
          Sort field
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded border px-2 py-2 text-foreground"
          >
            {SORT_FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <button
          className="rounded border px-3 py-2 text-sm"
          onClick={() => setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))}
          type="button"
        >
          Sort {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>

        <button className="rounded border px-3 py-2 text-sm" onClick={handlePrintFiltered} type="button">
          Print Filtered
        </button>

        <span className="text-sm text-muted-foreground">
          {sorted.length} shown ({activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ''})
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Import adds only new staff records not already on the list (auto-detected by Employee ID). Existing staff records are kept as-is.
        Compliance fields remain in this same combined table row and can be edited per staff member below.
      </p>

      <div className="overflow-auto rounded border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Position</th>
              <th className="p-2">Department</th>
              <th className="p-2">Emp Type</th>
              <th className="p-2">Date Hired</th>
              <th className="p-2">Status</th>
              <th className="p-2">Face Fit Test</th>
              <th className="p-2">Influenza</th>
              <th className="p-2">Pneumonia</th>
              <th className="p-2">Covid-19</th>
              <th className="p-2">Note</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((s) => {
              const influenzaState = seasonalStatus(s.influenzaStatus, s.influenzaDate);
              const covidState = seasonalStatus(s.covidStatus, s.covidDate);
              const inactive = s.status === 'inactive';
              return (
                <tr key={s.id} className={`border-b ${inactive ? 'opacity-60' : ''}`}>
                  <td className="p-2">{s.fullName}</td>
                  <td className="p-2">{s.role}</td>
                  <td className="p-2">{s.department || ''}</td>
                  <td className="p-2">{s.empType || ''}</td>
                  <td className="p-2">{s.hireDate || ''}</td>
                  <td className="p-2 capitalize">{s.status}</td>

                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{s.faceFitTestStatus || ''}</span>
                      <span className="text-muted-foreground">{s.faceFitTestDate || ''}</span>
                    </div>
                  </td>

                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {stateBadge(influenzaState)}
                      <span className="text-muted-foreground">{s.influenzaDate || ''}</span>
                    </div>
                  </td>

                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{s.pneumoniaStatus || ''}</span>
                      <span className="text-muted-foreground">{s.pneumoniaDate || ''}</span>
                    </div>
                  </td>

                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {stateBadge(covidState)}
                      <span className="text-muted-foreground">{s.covidDate || ''}</span>
                    </div>
                  </td>

                  <td className="p-2">{s.notes || ''}</td>

                  <td className="p-2">
                    <div className="flex gap-2">
                      <button className="text-blue-600 disabled:opacity-50" disabled={inactive} onClick={() => setEditingStaff(s)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {sorted.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, sorted.length)} of {sorted.length} staff
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm">
            Rows per page:
            <select
              className="ml-2 rounded border px-2 py-1"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <div className="flex gap-1">
            <button
              className="rounded border px-3 py-1 disabled:opacity-50"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </button>
            <button
              className="rounded border px-3 py-1 disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              className="rounded border px-3 py-1 disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
            <button
              className="rounded border px-3 py-1 disabled:opacity-50"
              onClick={() => setCurrentPage(totalPages || 1)}
              disabled={currentPage >= totalPages}
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {editingStaff && <StaffEditModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSave={handleSaveEdit} />}
    </div>
  );
}

function StaffEditModal({ staff, onClose, onSave }: { staff: StaffMember; onClose: () => void; onSave: (staff: StaffMember) => void }) {
  const [roleValue, setRoleValue] = useState<StaffRole | 'Other'>(
    staff.role && ROLE_OPTIONS.some((option) => option.value === staff.role) ? (staff.role as StaffRole) : 'Other'
  );
  const [roleOther, setRoleOther] = useState(staff.role && !ROLE_OPTIONS.some((option) => option.value === staff.role) ? String(staff.role) : '');

  const [deptValue, setDeptValue] = useState<string>(
    staff.department && DEPARTMENT_OPTIONS.some((option) => option.value === staff.department)
      ? staff.department
      : staff.department
      ? 'Other'
      : ''
  );
  const [deptOther, setDeptOther] = useState(
    staff.department && !DEPARTMENT_OPTIONS.some((option) => option.value === staff.department) ? staff.department : ''
  );

  const [empType, setEmpType] = useState(staff.empType || '');
  const [hireDate, setHireDate] = useState(staff.hireDate || '');

  const [faceFitTestStatus, setFaceFitTestStatus] = useState<FaceFitStatus | ''>((staff.faceFitTestStatus as FaceFitStatus) || '');
  const [faceFitTestDate, setFaceFitTestDate] = useState(staff.faceFitTestDate || '');

  const [influenzaStatus, setInfluenzaStatus] = useState<ComplianceBinaryStatus | ''>((staff.influenzaStatus as ComplianceBinaryStatus) || '');
  const [influenzaDate, setInfluenzaDate] = useState(staff.influenzaDate || '');

  const [pneumoniaStatus, setPneumoniaStatus] = useState<ComplianceBinaryStatus | ''>((staff.pneumoniaStatus as ComplianceBinaryStatus) || '');
  const [pneumoniaDate, setPneumoniaDate] = useState(staff.pneumoniaDate || '');

  const [covidStatus, setCovidStatus] = useState<ComplianceBinaryStatus | ''>((staff.covidStatus as ComplianceBinaryStatus) || '');
  const [covidDate, setCovidDate] = useState(staff.covidDate || '');

  const [notes, setNotes] = useState(staff.notes || '');

  function handleSave() {
    let finalRole: StaffRole | string | undefined;
    if (roleValue === 'Other') {
      finalRole = roleOther || undefined;
    } else if (roleValue) {
      finalRole = roleValue;
    }

    let finalDept: string | undefined;
    if (deptValue === 'Other') {
      finalDept = deptOther || undefined;
    } else if (deptValue) {
      finalDept = deptValue;
    }

    const updated: StaffMember = {
      ...staff,
      role: finalRole,
      department: finalDept,
      empType: empType || undefined,
      hireDate: hireDate || undefined,

      faceFitTestStatus: (faceFitTestStatus || undefined) as FaceFitStatus | undefined,
      faceFitTestDate: faceFitTestDate || undefined,

      influenzaStatus: (influenzaStatus || undefined) as ComplianceBinaryStatus | undefined,
      influenzaDate: influenzaDate || undefined,

      pneumoniaStatus: (pneumoniaStatus || undefined) as ComplianceBinaryStatus | undefined,
      pneumoniaDate: pneumoniaDate || undefined,

      covidStatus: (covidStatus || undefined) as ComplianceBinaryStatus | undefined,
      covidDate: covidDate || undefined,

      notes,
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl space-y-4 rounded-lg bg-white p-4">
        <h2 className="text-lg font-semibold">Edit Staff Member</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-sm">
            Position / Role
            <select className="mt-1 w-full rounded border px-3 py-2" value={roleValue} onChange={(e) => setRoleValue(e.target.value as StaffRole | 'Other')}>
              <option value="">Select role</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {roleValue === 'Other' && (
            <label className="block text-sm">
              Other role
              <input className="mt-1 w-full rounded border px-3 py-2" type="text" value={roleOther} onChange={(e) => setRoleOther(e.target.value)} placeholder="Enter role/title" />
            </label>
          )}

          <label className="block text-sm">
            Department
            <select className="mt-1 w-full rounded border px-3 py-2" value={deptValue} onChange={(e) => setDeptValue(e.target.value)}>
              <option value="">Select department</option>
              {DEPARTMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {deptValue === 'Other' && (
            <label className="block text-sm">
              Other department
              <input className="mt-1 w-full rounded border px-3 py-2" type="text" value={deptOther} onChange={(e) => setDeptOther(e.target.value)} placeholder="Enter department" />
            </label>
          )}

          <label className="block text-sm">
            Emp Type
            <input className="mt-1 w-full rounded border px-3 py-2" type="text" value={empType} onChange={(e) => setEmpType(e.target.value)} placeholder="FT, PT, PRN, etc." />
          </label>

          <label className="block text-sm">
            Date Hired
            <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-semibold">Face Fit Test</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                Status
                <select className="mt-1 w-full rounded border px-3 py-2" value={faceFitTestStatus} onChange={(e) => setFaceFitTestStatus(e.target.value as FaceFitStatus | '')}>
                  <option value="">Select</option>
                  <option value="pass">Pass</option>
                  <option value="failed">Failed</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
              <label className="block text-sm">
                Date
                <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={faceFitTestDate} onChange={(e) => setFaceFitTestDate(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-semibold">Influenza (Seasonal)</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                Status
                <select className="mt-1 w-full rounded border px-3 py-2" value={influenzaStatus} onChange={(e) => setInfluenzaStatus(e.target.value as ComplianceBinaryStatus | '')}>
                  <option value="">Select</option>
                  <option value="vaccinated">Vaccinated</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
              <label className="block text-sm">
                Date
                <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={influenzaDate} onChange={(e) => setInfluenzaDate(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-semibold">Pneumonia</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                Status
                <select className="mt-1 w-full rounded border px-3 py-2" value={pneumoniaStatus} onChange={(e) => setPneumoniaStatus(e.target.value as ComplianceBinaryStatus | '')}>
                  <option value="">Select</option>
                  <option value="vaccinated">Vaccinated</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
              <label className="block text-sm">
                Date
                <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={pneumoniaDate} onChange={(e) => setPneumoniaDate(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-semibold">Covid-19 (Seasonal)</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                Status
                <select className="mt-1 w-full rounded border px-3 py-2" value={covidStatus} onChange={(e) => setCovidStatus(e.target.value as ComplianceBinaryStatus | '')}>
                  <option value="">Select</option>
                  <option value="vaccinated">Vaccinated</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
              <label className="block text-sm">
                Date
                <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={covidDate} onChange={(e) => setCovidDate(e.target.value)} />
              </label>
            </div>
          </div>
        </div>

        <label className="block text-sm">
          Notes
          <input className="mt-1 w-full rounded border px-3 py-2" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="flex justify-end gap-2">
          <button className="nav-item" onClick={onClose}>Cancel</button>
          <button className="nav-item active" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default StaffManagementPage;
