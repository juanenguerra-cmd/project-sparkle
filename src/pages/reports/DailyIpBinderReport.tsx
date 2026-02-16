import React from 'react';
import { format } from 'date-fns';
import { useDailyIpBinderData } from '@/lib/reports/useDailyIpBinderData';

interface DailyIpBinderReportProps {
  date: string;
  unitId: string;
}

const renderEmptyState = (columns: number) => (
  <tr>
    <td colSpan={columns} className="py-2 text-center text-muted-foreground">No items for today</td>
  </tr>
);

const DailyIpBinderReport = ({ date, unitId }: DailyIpBinderReportProps) => {
  const data = useDailyIpBinderData({ date, unitId });

  return (
    <div id="report-content" className="binder-report bg-white text-black p-6">
      <style>{`
        .binder-page { page-break-after: always; }
        @media print { header { position: static; } }
      `}</style>
      <section className="binder-page space-y-4">
        <header>
          <h1 className="text-xl font-bold">Daily Infection Prevention Binder</h1>
          <p>Unit: {data.unit.name} | Date: {format(new Date(date), 'MM/dd/yyyy')}</p>
        </header>

        <h2 className="font-semibold">1. Census & Risk Overview</h2>
        <table className="w-full text-sm border-collapse border">
          <thead><tr><th>Room</th><th>Resident Name</th><th>MRN</th><th>Admission Date</th><th>Risk Flags</th><th>New Admission/Readmission</th><th>Primary Diagnosis</th><th>Notes</th></tr></thead>
          <tbody>{data.census.length === 0 ? renderEmptyState(8) : data.census.map((row, index) => <tr key={`census-${index}`}><td>{row.room}</td><td>{row.residentName}</td><td>{row.mrn}</td><td>{row.admissionDate}</td><td>{row.riskFlags}</td><td>{row.newAdmissionReadmission}</td><td>{row.primaryDiagnosis}</td><td>{row.notes}</td></tr>)}</tbody>
        </table>

        <h2 className="font-semibold">2. Active Infections & Precautions</h2>
        <table className="w-full text-sm border-collapse border">
          <thead><tr><th>Room</th><th>Resident Name</th><th>Infection/Diagnosis</th><th>Organism</th><th>Site</th><th>Onset Date</th><th>HAI vs Community</th><th>Precaution Type</th><th>Precaution Start Date</th><th>Target Review/End Date</th><th>Cohorting Notes</th></tr></thead>
          <tbody>{data.infections.length === 0 ? renderEmptyState(11) : data.infections.map((row, index) => <tr key={`infection-${index}`}><td>{row.room}</td><td>{row.residentName}</td><td>{row.infectionDiagnosis}</td><td>{row.organism}</td><td>{row.site}</td><td>{row.onsetDate}</td><td>{row.haiVsCommunity}</td><td>{row.precautionType}</td><td>{row.precautionStartDate}</td><td>{row.targetReviewEndDate}</td><td>{row.cohortingNotes}</td></tr>)}</tbody>
        </table>

        <h2 className="font-semibold">3. Outbreaks & Clusters</h2>
        <table className="w-full text-sm border-collapse border">
          <thead><tr><th>Outbreak Type</th><th>Status</th><th>Unit(s) Affected</th><th>Date Declared</th><th>Cases Today</th><th>Total Cases</th><th>Control Measures</th><th>Notes</th></tr></thead>
          <tbody>{data.outbreaks.length === 0 ? renderEmptyState(8) : data.outbreaks.map((row, index) => <tr key={`outbreak-${index}`}><td>{row.outbreakType}</td><td>{row.status}</td><td>{row.unitsAffected}</td><td>{row.dateDeclared}</td><td>{row.casesToday}</td><td>{row.totalCases}</td><td>{row.controlMeasures}</td><td>{row.notes}</td></tr>)}</tbody>
        </table>

        <h2 className="font-semibold">4. Devices & Invasive Procedures</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Room</th><th>Resident Name</th><th>Device Type</th><th>Insertion Date</th><th>Indication</th><th>Last Device Review Date</th><th>Review Today?</th><th>Planned Removal Date</th><th>Notes</th></tr></thead><tbody>{data.devices.length === 0 ? renderEmptyState(9) : data.devices.map((row, index) => <tr key={`device-${index}`}><td>{row.room}</td><td>{row.residentName}</td><td>{row.deviceType}</td><td>{row.insertionDate}</td><td>{row.indication}</td><td>{row.lastDeviceReviewDate}</td><td>{row.reviewToday}</td><td>{row.plannedRemovalDate}</td><td>{row.notes}</td></tr>)}</tbody></table>

        <h2 className="font-semibold">5. Vaccination & Prophylaxis</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Room</th><th>Resident Name</th><th>Vaccine</th><th>Last Dose Date</th><th>Declined Date</th><th>Decline Reason</th><th>Education Provided</th><th>Due/Overdue Status</th><th>Outbreak-Triggered Offer?</th><th>Notes</th></tr></thead><tbody>{data.vaccines.length === 0 ? renderEmptyState(10) : data.vaccines.map((row, index) => <tr key={`vax-${index}`}><td>{row.room}</td><td>{row.residentName}</td><td>{row.vaccine}</td><td>{row.lastDoseDate}</td><td>{row.declinedDate}</td><td>{row.declineReason}</td><td>{row.educationProvided}</td><td>{row.dueOverdueStatus}</td><td>{row.outbreakTriggeredOffer}</td><td>{row.notes}</td></tr>)}</tbody></table>

        <h2 className="font-semibold">6. Environmental Cleaning & Isolation Rooms</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Room</th><th>Resident Name</th><th>Reason</th><th>Status</th><th>Required Cleaning Type</th><th>Product/Method</th><th>Completion Status</th><th>Completed By/Time</th><th>Notes</th></tr></thead><tbody>{data.cleaningTasks.length === 0 ? renderEmptyState(9) : data.cleaningTasks.map((row, index) => <tr key={`clean-${index}`}><td>{row.room}</td><td>{row.residentName}</td><td>{row.reason}</td><td>{row.status}</td><td>{row.requiredCleaningType}</td><td>{row.productMethod}</td><td>{row.completionStatus}</td><td>{row.completedByTime}</td><td>{row.notes}</td></tr>)}</tbody></table>

        <h2 className="font-semibold">7. Lab & Diagnostic Follow-Ups</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Room</th><th>Resident Name</th><th>Specimen Type</th><th>Collection Date/Time</th><th>Status</th><th>Organism(s)</th><th>Susceptibility/MDRO Flag</th><th>Required Action</th><th>Action Completed?</th><th>Notes</th></tr></thead><tbody>{data.labs.length === 0 ? renderEmptyState(10) : data.labs.map((row, index) => <tr key={`lab-${index}`}><td>{row.room}</td><td>{row.residentName}</td><td>{row.specimenType}</td><td>{row.collectionDateTime}</td><td>{row.status}</td><td>{row.organisms}</td><td>{row.susceptibilityMdroFlag}</td><td>{row.requiredAction}</td><td>{row.actionCompleted}</td><td>{row.notes}</td></tr>)}</tbody></table>

        <h2 className="font-semibold">8. Hand Hygiene & PPE Focus</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Metric</th><th>Value</th><th>Notes</th></tr></thead><tbody>{data.handHygiene.length === 0 ? renderEmptyState(3) : data.handHygiene.map((row, index) => <tr key={`hh-${index}`}><td>{row.metric}</td><td>{row.value}</td><td>{row.notes}</td></tr>)}</tbody></table>

        <h2 className="font-semibold">9. Education & Staff Reminders</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Topic</th><th>Target Staff</th><th>Format</th><th>Materials Needed</th><th>Completed?</th><th>Notes</th></tr></thead><tbody>{data.education.length === 0 ? renderEmptyState(6) : data.education.map((row, index) => <tr key={`edu-${index}`}><td>{row.topic}</td><td>{row.targetStaff}</td><td>{row.format}</td><td>{row.materialsNeeded}</td><td>{row.completed}</td><td>{row.notes}</td></tr>)}</tbody></table>

        <h2 className="font-semibold">10. Action Items & IP Notes</h2>
        <table className="w-full text-sm border-collapse border"><thead><tr><th>Priority</th><th>Category</th><th>Description</th><th>Responsible Role</th><th>Due Date/Time</th><th>Status</th><th>IP Notes</th></tr></thead><tbody>{data.actionItems.length === 0 ? renderEmptyState(7) : data.actionItems.map((row, index) => <tr key={`action-${index}`}><td>{row.priority}</td><td>{row.category}</td><td>{row.description}</td><td>{row.responsibleRole}</td><td>{row.dueDateTime}</td><td>{row.status}</td><td>{row.ipNotes}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
};

export default DailyIpBinderReport;
