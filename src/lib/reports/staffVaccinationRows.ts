import { getAllStaff } from '@/lib/stores/staffStore';
import { getAllVaccinationRecords } from '@/lib/stores/vaxStore';

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

export function getStaffVaccinationRows(filters: {
  department?: string;
  status?: 'active' | 'inactive';
  season?: string;
}) {
  const staff = getAllStaff();
  const vax = getAllVaccinationRecords().filter((v) => v.subjectType === 'staff');

  return staff
    .filter((s) => (filters.status ? s.status === filters.status : true))
    .filter((s) => (filters.department ? s.department === filters.department : true))
    .map((s) => {
      const sv = vax.filter((v) => v.subjectId === s.id);
      const influenza = getLatestByType(sv, 'influenza', filters.season);
      const pneumo = getLatestByType(sv, 'pneumococcal');
      const covid = getLatestByType(sv, 'covid19');

      return {
        employeeId: s.employeeId,
        fullName: s.fullName,
        role: s.role,
        department: s.department,
        status: s.status,
        hireDate: s.hireDate,
        influenzaStatus: influenza?.status ?? 'no_record',
        influenzaLastDate: influenza?.date ?? null,
        influenzaLocation: influenza?.location ?? '',
        pneumoStatus: pneumo?.status ?? 'no_record',
        pneumoLastDate: pneumo?.date ?? null,
        pneumoLocation: pneumo?.location ?? '',
        covidStatus: covid?.status ?? 'no_record',
        covidLastDate: covid?.date ?? null,
        covidLocation: covid?.location ?? '',
      };
    });
}
