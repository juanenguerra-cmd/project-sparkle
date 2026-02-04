import { ReportData } from '@/lib/reportGenerators';
import { loadDB } from '@/lib/database';

interface IPDailyMorningReportPreviewProps {
  report: ReportData;
  facilityName?: string;
  printFontSize?: 'normal' | 'compact';
  columnWidth?: 'wide' | 'narrow';
}

const IPDailyMorningReportPreview = ({ report, facilityName, printFontSize = 'normal', columnWidth = 'wide' }: IPDailyMorningReportPreviewProps) => {
  const db = loadDB();
  const facility = facilityName || db.settings.facilityName || 'Healthcare Facility';
  const sections = report.sections || [];
  const isCompact = printFontSize === 'compact';
  const tableLayout = columnWidth === 'narrow' ? 'fixed' : 'auto';
  const wordBreak = columnWidth === 'narrow' ? 'break-word' : 'normal';
  const overflowWrap = columnWidth === 'narrow' ? 'anywhere' : 'normal';
  const cellPadding = isCompact ? '2px 4px' : '4px 8px';
  const tableFontSize = isCompact ? '8px' : '10px';

  return (
    <div
      className="report-preview bg-white text-black min-h-[400px] print:p-0 space-y-6"
      id="report-content"
      style={{ fontFamily: 'Arial, sans-serif', padding: isCompact ? '12px' : '24px' }}
    >
      <div className="text-center space-y-1">
        <h1 className="font-bold" style={{ fontSize: isCompact ? '11px' : '14px' }}>{facility}</h1>
        <h2 className="font-bold uppercase" style={{ fontSize: isCompact ? '10px' : '12px' }}>{report.title}</h2>
        <p style={{ fontSize: isCompact ? '10px' : '12px' }}>
          <span className="font-semibold">Date:</span> {report.filters.date || '—'}
        </p>
      </div>

      {sections.map(section => (
        <div key={section.title} className="space-y-2">
          <h3 className="font-semibold uppercase" style={{ fontSize: isCompact ? '10px' : '12px' }}>{section.title}</h3>
          <div className="border border-black">
            <table className="w-full border-collapse" style={{ fontSize: tableFontSize, tableLayout }}>
              <thead>
                <tr className="border-b border-black bg-[#F3F4F6]">
                  {section.headers.map(header => (
                    <th
                      key={header}
                      className="border-r border-black last:border-r-0 px-2 py-1 text-left"
                      style={{ padding: cellPadding, wordBreak, overflowWrap }}
                    >
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
                          style={{ padding: cellPadding, wordBreak, overflowWrap }}
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
