import { ReportData } from '@/lib/reportGenerators';
import { loadDB } from '@/lib/database';

interface ReportPreviewProps {
  report: ReportData;
  facilityName?: string;
  printFontSize?: 'normal' | 'compact';
  columnWidth?: 'wide' | 'narrow';
}

// Check if this is a precaution list report
const isPrecautionListReport = (title: string) => {
  return title.toUpperCase().includes('PRECAUTION') || title.toUpperCase().includes('ISOLATION');
};

const ReportPreview = ({ report, facilityName, printFontSize = 'normal', columnWidth = 'wide' }: ReportPreviewProps) => {
  const db = loadDB();
  const facility = facilityName || db.settings.facilityName || 'Long Beach Nursing & Rehabilitation Center';
  const isPrecautionList = isPrecautionListReport(report.title);
  const isCompact = printFontSize === 'compact';
  const tableLayout = columnWidth === 'narrow' ? 'fixed' : 'auto';
  const wordBreak = columnWidth === 'narrow' ? 'break-word' : 'normal';
  const overflowWrap = columnWidth === 'narrow' ? 'anywhere' : 'normal';
  const cellPadding = isCompact ? '2px 4px' : '4px 8px';
  const tableFontSize = isCompact ? '8px' : '10px';
  const headerFontSize = isCompact ? '12px' : '14px';
  const subtitleFontSize = isCompact ? '11px' : '12px';
  const filterFontSize = isCompact ? '10px' : '12px';
  const footerFontSize = isCompact ? '9px' : '10px';
  
  return (
    <div
      className="report-preview bg-white text-black min-h-[400px] print:p-0"
      id="report-content"
      style={{ fontFamily: 'Arial, sans-serif', padding: isCompact ? '12px' : '24px' }}
    >
      {/* Header - Exact template layout */}
      <div className="text-center mb-4" style={{ textAlign: 'center', marginBottom: '16px' }}>
        {/* Facility name - bold, larger */}
        <h1 className="font-bold mb-1" style={{ fontSize: headerFontSize }}>{facility}</h1>
        
        {/* Report title - bold, slightly smaller */}
        <h2 className="font-bold mb-3" style={{ fontSize: subtitleFontSize }}>{report.title}</h2>
        
        {/* Filter row: UNIT / DATE / SHIFT on same line */}
        <div
          className="flex justify-center gap-8 text-xs"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '32px',
            fontSize: filterFontSize,
            flexWrap: 'wrap'
          }}
        >
          <span>
            <strong>UNIT:</strong>{' '}
            <span className="border-b border-black px-2 inline-block" style={{ minWidth: '60px' }}>
              {report.filters.unit || ''}
            </span>
          </span>
          <span>
            <strong>DATE:</strong>{' '}
            <span className="border-b border-black px-2 inline-block" style={{ minWidth: '80px' }}>
              {report.filters.date || ''}
            </span>
          </span>
          <span>
            <strong>SHIFT:</strong>{' '}
            <span className="border-b border-black px-2 inline-block" style={{ minWidth: '40px' }}>
              {report.filters.shift || '—'}
            </span>
          </span>
        </div>
      </div>
      
      {/* Table - Exact template columns */}
      <div className="border border-black" style={{ border: '1px solid #000' }}>
        <table
          className="w-full border-collapse"
          style={{
            fontSize: tableFontSize,
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#FBBF24' }} className="border-b border-black">
              {report.headers.map((header, idx) => (
                <th
                  key={idx}
                  className="font-bold border-r border-black last:border-r-0 py-1 px-2 text-left align-middle"
                  style={{
                    fontWeight: 700,
                    borderRight: idx === report.headers.length - 1 ? 'none' : '1px solid #000',
                    padding: cellPadding,
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    wordBreak,
                    overflowWrap,
                    width: isPrecautionList && columnWidth === 'narrow'
                      ? ['50px', '200px', '150px', '120px', '110px'][idx]
                      : 'auto',
                    textAlign: isPrecautionList && idx === 3 ? 'center' : 'left'
                  }}
                >
                  {/* Template header names exactly */}
                  {isPrecautionList && idx === 3 ? (
                    <span className="text-center block whitespace-nowrap">
                      INFECTED<br/>SOURCE
                    </span>
                  ) : header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={report.headers.length} className="text-center py-4 text-gray-500">
                  No records found for the selected filters
                </td>
              </tr>
            ) : (
              report.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-black last:border-b-0 bg-white">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border-r border-black last:border-r-0 py-1 px-2 align-top"
                      style={{
                        borderRight: cellIdx === row.length - 1 ? 'none' : '1px solid #000',
                        padding: cellPadding,
                        verticalAlign: 'top',
                        wordBreak,
                        overflowWrap,
                        textAlign: isPrecautionList && cellIdx === 3 ? 'center' : 'left'
                      }}
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
      
      {/* Footer - Exact template layout */}
      {report.footer && (
        <div className="mt-6" style={{ fontSize: footerFontSize }}>
          {/* Row 1: Prepared by and Title on same line */}
          <div className="flex gap-12 mb-2">
            <div className="flex items-end">
              <strong>Prepared by:</strong>
              <span className="border-b border-black inline-block ml-1" style={{ minWidth: '180px' }}></span>
            </div>
            <div className="flex items-end">
              <strong>Title:</strong>
              <span className="border-b border-black inline-block ml-1" style={{ minWidth: '180px' }}></span>
            </div>
          </div>
          
          {/* Row 2: Signature and Date/Time on same line */}
          <div className="flex gap-12 mb-4">
            <div className="flex items-end">
              <strong>Signature:</strong>
              <span className="border-b border-black inline-block ml-1" style={{ minWidth: '180px' }}></span>
            </div>
            <div className="flex items-end">
              <strong>Date/Time:</strong>
              <span className="border-b border-black inline-block ml-1" style={{ minWidth: '180px' }}></span>
            </div>
          </div>
          
          {/* Disclaimer - smaller italic text */}
          {report.footer.disclaimer && (
            <p className="italic mt-4" style={{ fontSize: '8px', color: '#333', lineHeight: '1.3' }}>
              * {report.footer.disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportPreview;
