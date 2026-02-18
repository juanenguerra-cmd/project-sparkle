import React, { useMemo, useState } from 'react';
import { convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';
import { getAllStaff, saveStaffList, upsertStaff } from '@/lib/stores/staffStore';
import { importStaffFromCSVRows, type RawStaffRow } from '@/lib/utils/staffImport';
import type { StaffMember, StaffRole } from '@/lib/types/staff';

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

export function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>(() => getAllStaff());
  const [search, setSearch] = useState('');
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const filtered = useMemo(
    () =>
      staff.filter((s) => {
        const needle = search.toLowerCase();
        return s.employeeId.toLowerCase().includes(needle) || s.fullName.toLowerCase().includes(needle);
      }),
    [staff, search]
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text) as RawStaffRow[];
    const result = importStaffFromCSVRows(rows);
    if (result) {
      setStaff(getAllStaff());
      alert(`Import complete.\nNew: ${result.newCount}\nUpdated: ${result.updatedCount}\nInactivated: ${result.inactivatedCount}`);
    }
    e.target.value = '';
  };

  const handleExport = () => {
    const columns = ['employeeId', 'fullName', 'role', 'center', 'department', 'empType', 'status', 'hireDate', 'faceFitTestDate', 'notes'];
    const csv = convertToCSV(staff as unknown as Array<Record<string, unknown>>, columns);
    downloadCSV(csv, 'staff-roster.csv');
  };

  const handleSaveEdit = (updated: StaffMember) => {
    upsertStaff(updated);
    setStaff(getAllStaff());
    setEditingStaff(null);
  };

  const handleMarkInactive = (member: StaffMember) => {
    const updated = { ...member, status: 'inactive' as const, updatedAt: new Date().toISOString() };
    const next = staff.map((entry) => (entry.id === member.id ? updated : entry));
    saveStaffList(next);
    setStaff(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff / Employee List</h1>
        <div className="flex gap-2">
          <button className="nav-item" onClick={handleExport}>Export Staff List (CSV)</button>
          <label className="nav-item cursor-pointer">
            Import Staff List (CSV)
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Search by name or employee ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border px-3 py-2"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} staff</span>
      </div>

      <p className="text-sm text-muted-foreground">Update or import staff demographic fields here (Name, Position, Center, Department, Emp Type, Date Hired). Vaccine details are tracked in the Staff Vaccination Tracker page, and Face Fit Test can be entered directly when editing each staff member below.</p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            <th className="p-2">Employee ID</th>
            <th className="p-2">Name</th>
            <th className="p-2">Position</th>
            <th className="p-2">Center</th>
            <th className="p-2">Department</th>
            <th className="p-2">Emp Type</th>
            <th className="p-2">Status</th>
            <th className="p-2">Date Hired</th>
            <th className="p-2">Face Fit Test</th>
            <th className="p-2">Notes</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="p-2">{s.employeeId}</td>
              <td className="p-2">{s.fullName}</td>
              <td className="p-2">{s.role}</td>
              <td className="p-2">{s.center || ''}</td>
              <td className="p-2">{s.department}</td>
              <td className="p-2">{s.empType || ''}</td>
              <td className="p-2 capitalize">{s.status}</td>
              <td className="p-2">{s.hireDate || ''}</td>
              <td className="p-2">{s.faceFitTestDate || ''}</td>
              <td className="p-2">{s.notes || ''}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  <button className="text-blue-600" onClick={() => setEditingStaff(s)}>Edit</button>
                  {s.status !== 'inactive' && <button className="text-red-600" onClick={() => handleMarkInactive(s)}>Inactivate</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingStaff && <StaffEditModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSave={handleSaveEdit} />}
    </div>
  );
}

function StaffEditModal({ staff, onClose, onSave }: { staff: StaffMember; onClose: () => void; onSave: (staff: StaffMember) => void }) {
  const [roleValue, setRoleValue] = useState<StaffRole | 'Other'>(
    staff.role && ROLE_OPTIONS.some((option) => option.value === staff.role) ? (staff.role as StaffRole) : 'Other'
  );
  const [roleOther, setRoleOther] = useState(staff.role && !ROLE_OPTIONS.some((option) => option.value === staff.role) ? staff.role : '');

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

  const [center, setCenter] = useState(staff.center || '');
  const [empType, setEmpType] = useState(staff.empType || '');
  const [faceFitTestDate, setFaceFitTestDate] = useState(staff.faceFitTestDate || '');
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
      center: center || undefined,
      department: finalDept,
      empType: empType || undefined,
      faceFitTestDate: faceFitTestDate || undefined,
      notes,
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg bg-white p-4">
        <h2 className="text-lg font-semibold">Edit Staff Member</h2>

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
          Center
          <input className="mt-1 w-full rounded border px-3 py-2" type="text" value={center} onChange={(e) => setCenter(e.target.value)} placeholder="Enter center" />
        </label>

        <label className="block text-sm">
          Emp Type
          <input className="mt-1 w-full rounded border px-3 py-2" type="text" value={empType} onChange={(e) => setEmpType(e.target.value)} placeholder="APT, FT, etc." />
        </label>

        <label className="block text-sm">
          Face Fit Test Date
          <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={faceFitTestDate} onChange={(e) => setFaceFitTestDate(e.target.value)} />
        </label>

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
