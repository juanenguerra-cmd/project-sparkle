// Auto-discharge logic for residents dropped from census
// This module handles automatically closing tracker records when residents leave

import { ICNDatabase, addAudit, saveDB } from './database';
import { nowISO } from './parsers';

export interface DischargeResult {
  abtClosed: number;
  ipClosed: number;
  vaxClosed: number;
  residentNames: string[];
}

/**
 * Auto-discharge all tracker records for residents no longer on census
 * Called after census import when residents are marked inactive
 */
export const autoDischargeDroppedResidents = (
  db: ICNDatabase, 
  droppedMRNs: string[]
): DischargeResult => {
  console.log(`[Auto-Discharge] Processing ${droppedMRNs.length} dropped MRNs:`, droppedMRNs);
  
  if (droppedMRNs.length === 0) {
    return { abtClosed: 0, ipClosed: 0, vaxClosed: 0, residentNames: [] };
  }

  const now = nowISO();
  const today = now.slice(0, 10);
  const droppedSet = new Set(droppedMRNs);
  const residentNames: string[] = [];

  // Collect resident names for audit
  droppedMRNs.forEach(mrn => {
    const resident = db.census.residentsByMrn[mrn];
    if (resident?.name) {
      residentNames.push(resident.name);
    }
  });

  console.log(`[Auto-Discharge] Resident names:`, residentNames);
  console.log(`[Auto-Discharge] Total ABT records:`, db.records.abx.length);
  console.log(`[Auto-Discharge] Total IP cases:`, db.records.ip_cases.length);
  console.log(`[Auto-Discharge] Total VAX records:`, db.records.vax.length);

  // 1. Close ABT records - mark as discontinued with discharge note
  let abtClosed = 0;
  db.records.abx.forEach(record => {
    const isDropped = droppedSet.has(record.mrn);
    const isActive = record.status === 'active';
    if (isDropped && isActive) {
      console.log(`[Auto-Discharge] Closing ABT: ${record.medication || record.med_name} for MRN ${record.mrn}`);
      record.status = 'discontinued';
      record.endDate = today;
      record.end_date = today;
      record.notes = `${record.notes || ''} [Auto-closed: Resident discharged from census ${today}]`.trim();
      abtClosed++;
    }
  });

  // 2. Close IP cases - mark as Discharged
  let ipClosed = 0;
  db.records.ip_cases.forEach(record => {
    const isDropped = droppedSet.has(record.mrn);
    const isActive = record.status === 'Active';
    if (isDropped && isActive) {
      console.log(`[Auto-Discharge] Closing IP: ${record.infectionType || record.infection_type} for MRN ${record.mrn}`);
      record.status = 'Discharged';
      record.resolutionDate = today;
      record.resolution_date = today;
      record._autoClosed = true;
      record._autoClosedReason = 'Resident discharged from census';
      record.notes = `${record.notes || ''} [Auto-closed: Resident discharged from census ${today}]`.trim();
      ipClosed++;
    }
  });

  // 3. Close VAX records - mark as declined since resident is no longer here
  let vaxClosed = 0;
  db.records.vax.forEach(record => {
    const isDropped = droppedSet.has(record.mrn);
    const isDueOrOverdue = record.status === 'due' || record.status === 'overdue';
    if (isDropped && isDueOrOverdue) {
      console.log(`[Auto-Discharge] Closing VAX: ${record.vaccine || record.vaccine_type} for MRN ${record.mrn}`);
      record.status = 'declined';
      record.notes = `${record.notes || ''} [Auto-closed: Resident discharged from census ${today}]`.trim();
      vaxClosed++;
    }
  });

  console.log(`[Auto-Discharge] Results: ${abtClosed} ABT, ${ipClosed} IP, ${vaxClosed} VAX closed`);

  // Add audit entry for the auto-discharge
  if (abtClosed > 0 || ipClosed > 0 || vaxClosed > 0) {
    const details = [
      abtClosed > 0 ? `${abtClosed} ABT` : null,
      ipClosed > 0 ? `${ipClosed} IP` : null,
      vaxClosed > 0 ? `${vaxClosed} VAX` : null,
    ].filter(Boolean).join(', ');
    
    addAudit(
      db, 
      'auto_discharge', 
      `Auto-closed records for ${droppedMRNs.length} discharged resident(s): ${details}`, 
      'census'
    );
  }

  return { abtClosed, ipClosed, vaxClosed, residentNames };
};
