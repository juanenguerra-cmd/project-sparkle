import { ReportData } from '@/lib/reportGenerators';
import { loadDB } from '@/lib/database';

interface IPDailyMorningReportPreviewProps {
  report: ReportData;
  facilityName?: string;
}

const IPDailyMorningReportPreview = ({ report, facilityName }: IPDailyMorningReportPreviewProps) => {
  const db = loadDB();
  const facility = facilityName || db.settings.facilityName || 'Healthcare Facility';
  const sections = report.sections || [];

  return (
    <div
      className="report-preview bg-white text-black p-6 min-h-[400px] print:p-0 space-y-6"
      id="report-content"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="text-center space-y-1">
        <h1 className="font-bold text-sm">{facility}</h1>
        <h2 className="font-bold text-xs uppercase">{report.title}</h2>
        <p className="text-xs">
          <span className="font-semibold">Date:</span> {report.filters.date || '—'}
        </p>
      </div>

      {sections.map(section => (
        <div key={section.title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase">{section.title}</h3>
          <div className="border border-black">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-black bg-[#F3F4F6]">
                  {section.headers.map(header => (
                    <th key={header} className="border-r border-black last:border-r-0 px-2 py-1 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.length === 0 ? (
                  <tr>
                    <td colSpan={section.headers.length} className="py-3 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                ) : (
                  section.rows.map((row, rowIndex) => (
                    <tr key={`${section.title}-${rowIndex}`} className="border-b border-black last:border-b-0">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${section.title}-${rowIndex}-${cellIndex}`}
                          className="border-r border-black last:border-r-0 px-2 py-1 align-top"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default IPDailyMorningReportPreview;
