import React, { useMemo, useState } from 'react';
import { getAllStaff } from '@/lib/stores/staffStore';
import { getAllVaccinationRecords } from '@/lib/stores/vaxStore';
import { getInfluenzaSeasonForDate } from '@/lib/utils/vaccineSeasons';

export function StaffVaccinationTrackerPage() {
  const staff = getAllStaff();
  const allVax = getAllVaccinationRecords().filter((v) => v.subjectType === 'staff');

  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [season, setSeason] = useState<string>(() => getInfluenzaSeasonForDate());

  const departments = useMemo(
    () => Array.from(new Set(staff.map((s) => s.department).filter(Boolean) as string[])).sort(),
    [staff]
  );

  const rows = useMemo(
    () =>
      staff
        .filter((s) => (statusFilter === 'all' ? true : s.status === statusFilter))
        .filter((s) => (departmentFilter ? s.department === departmentFilter : true))
        .map((s) => {
          const vax = allVax.filter((v) => v.subjectId === s.id);
          const influenza = getLatestByType(vax, 'influenza', season);
          const pneumo = getLatestByType(vax, 'pneumococcal');
          const covid = getLatestByType(vax, 'covid19');
          return { staff: s, influenza, pneumo, covid };
        }),
    [staff, allVax, statusFilter, departmentFilter, season]
  );

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Staff Vaccination Tracker</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select className="rounded border px-3 py-2" value={departmentFilter || 'all'} onChange={(e) => setDepartmentFilter(e.target.value === 'all' ? '' : e.target.value)}>
          <option value="all">All Departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>
        <select className="rounded border px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input className="rounded border px-3 py-2" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Influenza season (e.g. 2025-2026)" />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            <th className="p-2">Employee ID</th>
            <th className="p-2">Name</th>
            <th className="p-2">Role</th>
            <th className="p-2">Department</th>
            <th className="p-2">Influenza</th>
            <th className="p-2">Pneumococcal</th>
            <th className="p-2">COVID-19</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ staff: s, influenza, pneumo, covid }) => (
            <tr key={s.id} className="border-b">
              <td className="p-2">{s.employeeId}</td>
              <td className="p-2">{s.fullName}</td>
              <td className="p-2">{s.role}</td>
              <td className="p-2">{s.department}</td>
              <td className="p-2">{formatStatus(influenza)}</td>
              <td className="p-2">{formatStatus(pneumo)}</td>
              <td className="p-2">{formatStatus(covid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getLatestByType(records: any[], type: string, season?: string) {
  const filtered = records.filter((r) => r.vaccineType === type);
  const seasonFiltered = type === 'influenza' && season ? filtered.filter((r) => r.seasonTag === season) : filtered;
  if (seasonFiltered.length === 0) return null;

  const sorted = seasonFiltered.slice().sort((a, b) => {
    const da = a.dateGiven || a.dateDeclined;
    const db = b.dateGiven || b.dateDeclined;
    return (db || '').localeCompare(da || '');
  });

  const latest = sorted[0];
  return {
    status: latest.status,
    date: latest.dateGiven || latest.dateDeclined || null,
    location: latest.location,
  };
}

function formatStatus(r: any | null) {
  if (!r) return 'No record';
  if (r.status === 'vaccinated') return `Vaccinated (${r.date || 'date?'}, ${r.location})`;
  if (r.status === 'declined') return `Declined (${r.date || 'date?'})`;
  return 'No record';
}

export default StaffVaccinationTrackerPage;
