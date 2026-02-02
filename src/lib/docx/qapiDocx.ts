// QAPI Report Word Document Generator
// Generates editable .docx files for Infection Control, IP, and VAX QAPI reports

import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  Packer,
  convertInchesToTwip
} from 'docx';
import { QAPIReportData, QAPIIPReportData, QAPIVaxReportData, QAPI_CATEGORIES } from '../reports/qapiReport';
import { format } from 'date-fns';

// Helper to save document
export const saveDocx = async (doc: Document, filename: string) => {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Common styles
const TITLE_STYLE = {
  bold: true,
  size: 32,
  font: 'Arial'
};

const HEADING_STYLE = {
  bold: true,
  size: 24,
  font: 'Arial'
};

const SUBHEADING_STYLE = {
  bold: true,
  size: 20,
  font: 'Arial'
};

const NORMAL_STYLE = {
  size: 22,
  font: 'Arial'
};

const TABLE_HEADER_STYLE = {
  bold: true,
  size: 18,
  font: 'Arial'
};

const TABLE_CELL_STYLE = {
  size: 18,
  font: 'Arial'
};

// Create table cell with proper styling
const createCell = (text: string, isHeader = false, width?: number): TableCell => {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            ...(isHeader ? TABLE_HEADER_STYLE : TABLE_CELL_STYLE)
          })
        ],
        alignment: AlignmentType.CENTER
      })
    ],
    shading: isHeader ? { fill: 'E0E0E0' } : undefined,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    margins: {
      top: convertInchesToTwip(0.05),
      bottom: convertInchesToTwip(0.05),
      left: convertInchesToTwip(0.1),
      right: convertInchesToTwip(0.1)
    }
  });
};

// Create PDCA section
const createPDCASection = (phase: string, content: string[]): Paragraph[] => {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: phase, ...SUBHEADING_STYLE, color: '1F4E79' })],
      spacing: { before: 300, after: 100 }
    })
  ];
  
  content.forEach(line => {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: line, ...NORMAL_STYLE })],
        spacing: { after: 100 },
        bullet: { level: 0 }
      })
    );
  });
  
  return paragraphs;
};

// =====================================================
// QAPI INFECTION CONTROL/ABT WORD DOCUMENT
// =====================================================

export const buildQAPIInfectionControlDocx = (data: QAPIReportData): Document => {
  const children: (Paragraph | Table)[] = [];
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'QAPI REPORT: INFECTION CONTROL / ANTIBIOTIC STEWARDSHIP', ...TITLE_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `${data.quarter} ${data.year} | ${data.facilityName}`, ...NORMAL_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Surveillance Period: ${data.periodRange}`, ...NORMAL_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );
  
  // PLAN Section
  children.push(...createPDCASection('PLAN', [
    'Goal: Reduce healthcare-associated infections and optimize antibiotic utilization',
    'Apply McGeer Criteria for infection surveillance',
    'Track antibiotic utilization ratio (AUR) benchmarked against national standards',
    'Monitor infection rates per 1,000 resident days'
  ]));
  
  // DO Section
  children.push(...createPDCASection('DO', [
    'Review all new infection cases using McGeer criteria',
    'Conduct antibiotic stewardship rounds weekly',
    'Document culture results and antibiotic appropriateness',
    'Perform infection source tracking and contact tracing'
  ]));
  
  // CHECK Section - Tables
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'CHECK - Data Analysis', ...SUBHEADING_STYLE, color: '1F4E79' })],
      spacing: { before: 300, after: 200 }
    })
  );
  
  // Table 1: Infection Rate per 1000 Resident Days
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Table 1: Infection Rate per 1,000 Resident Days', ...SUBHEADING_STYLE })],
      spacing: { before: 200, after: 100 }
    })
  );
  
  const table1Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Category', true),
        ...data.infectionRatePer1000.months.map(m => createCell(m.monthLabel.split(' ')[0], true)),
        createCell('Quarter Total', true),
        createCell('Rate/1000 RD', true)
      ]
    })
  ];
  
  QAPI_CATEGORIES.forEach(cat => {
    table1Rows.push(
      new TableRow({
        children: [
          createCell(cat),
          ...data.infectionRatePer1000.months.map(m => createCell(m.newInfections[cat].toString())),
          createCell(data.infectionRatePer1000.quarterTotal[cat].count.toString()),
          createCell(data.infectionRatePer1000.quarterTotal[cat].rate.toFixed(2))
        ]
      })
    );
  });
  
  // Total row
  const totalInfections = QAPI_CATEGORIES.reduce((sum, cat) => sum + data.infectionRatePer1000.quarterTotal[cat].count, 0);
  const totalResidentDays = data.infectionRatePer1000.months.reduce((sum, m) => sum + m.residentDays, 0);
  const totalRate = totalResidentDays > 0 ? (totalInfections / totalResidentDays) * 1000 : 0;
  
  table1Rows.push(
    new TableRow({
      children: [
        createCell('TOTAL', true),
        ...data.infectionRatePer1000.months.map(m => createCell(m.totalInfections.toString())),
        createCell(totalInfections.toString()),
        createCell(totalRate.toFixed(2))
      ]
    })
  );
  
  children.push(
    new Table({
      rows: table1Rows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Previous Quarter (${data.previousQuarter} ${data.previousYear}): ${data.infectionRatePer1000.previousQuarterTotal} infections`, ...TABLE_CELL_STYLE, italics: true })],
      spacing: { before: 100, after: 300 }
    })
  );
  
  // Table 2: Infection Rate by Census
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Table 2: Infection Rate by Census', ...SUBHEADING_STYLE })],
      spacing: { before: 200, after: 100 }
    })
  );
  
  const avgCensus = data.infectionRateByCensus.months.length > 0
    ? data.infectionRateByCensus.months.reduce((sum, m) => sum + m.avgCensus, 0) / data.infectionRateByCensus.months.length
    : 0;
  
  const table2Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Metric', true),
        ...data.infectionRateByCensus.months.map(m => createCell(m.monthLabel.split(' ')[0], true)),
        createCell('Quarter', true)
      ]
    }),
    new TableRow({
      children: [
        createCell('Avg Census'),
        ...data.infectionRateByCensus.months.map(m => createCell(m.avgCensus.toString())),
        createCell(Math.round(avgCensus).toString())
      ]
    }),
    new TableRow({
      children: [
        createCell('Total Infections'),
        ...data.infectionRateByCensus.months.map(m => createCell(m.totalInfections.toString())),
        createCell(totalInfections.toString())
      ]
    }),
    new TableRow({
      children: [
        createCell('Rate (%)'),
        ...data.infectionRateByCensus.months.map(m => {
          const rate = m.avgCensus > 0 ? (m.totalInfections / m.avgCensus) * 100 : 0;
          return createCell(rate.toFixed(1) + '%');
        }),
        createCell((avgCensus > 0 ? (totalInfections / avgCensus) * 100 : 0).toFixed(1) + '%')
      ]
    })
  ];
  
  children.push(
    new Table({
      rows: table2Rows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }),
    new Paragraph({ text: '', spacing: { after: 300 } })
  );
  
  // Table 3: HAI vs Prior to Admission
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Table 3: HAI vs Prior to Admission', ...SUBHEADING_STYLE })],
      spacing: { before: 200, after: 100 }
    })
  );
  
  const table3Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Classification', true),
        ...data.infectionRatePer1000.months.map(m => createCell(m.monthLabel.split(' ')[0], true)),
        createCell('Total', true)
      ]
    }),
    new TableRow({
      children: [
        createCell('Healthcare-Associated (HAI)'),
        ...data.haiSplit.hai.months.map(n => createCell(n.toString())),
        createCell(data.haiSplit.hai.total.toString())
      ]
    }),
    new TableRow({
      children: [
        createCell('Prior to Admission'),
        ...data.haiSplit.priorToAdmit.months.map(n => createCell(n.toString())),
        createCell(data.haiSplit.priorToAdmit.total.toString())
      ]
    })
  ];
  
  children.push(
    new Table({
      rows: table3Rows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }),
    new Paragraph({ text: '', spacing: { after: 300 } })
  );
  
  // Table 4: ABT Starts per 1000 Resident Days
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Table 4: Antibiotic Starts per 1,000 Resident Days', ...SUBHEADING_STYLE })],
      spacing: { before: 200, after: 100 }
    })
  );
  
  const table4Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Category', true),
        ...data.abtStartsPer1000.months.map(m => createCell(m.monthLabel.split(' ')[0], true)),
        createCell('Quarter Total', true),
        createCell('Rate/1000 RD', true)
      ]
    })
  ];
  
  QAPI_CATEGORIES.forEach(cat => {
    table4Rows.push(
      new TableRow({
        children: [
          createCell(cat),
          ...data.abtStartsPer1000.months.map(m => createCell(m.abtStarts[cat].toString())),
          createCell(data.abtStartsPer1000.quarterTotal[cat].count.toString()),
          createCell(data.abtStartsPer1000.quarterTotal[cat].rate.toFixed(2))
        ]
      })
    );
  });
  
  const totalABT = QAPI_CATEGORIES.reduce((sum, cat) => sum + data.abtStartsPer1000.quarterTotal[cat].count, 0);
  const totalABTRate = totalResidentDays > 0 ? (totalABT / totalResidentDays) * 1000 : 0;
  
  table4Rows.push(
    new TableRow({
      children: [
        createCell('TOTAL', true),
        ...data.abtStartsPer1000.months.map(m => createCell(m.totalABTStarts.toString())),
        createCell(totalABT.toString()),
        createCell(totalABTRate.toFixed(2))
      ]
    })
  );
  
  children.push(
    new Table({
      rows: table4Rows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Previous Quarter: ${data.abtStartsPer1000.previousQuarterTotal} ABT starts`, ...TABLE_CELL_STYLE, italics: true })],
      spacing: { before: 100, after: 300 }
    })
  );
  
  // Table 5: Antibiotic Utilization Ratio (AUR)
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Table 5: Antibiotic Utilization Ratio (AUR) - Days of Therapy per 1,000 Resident Days', ...SUBHEADING_STYLE })],
      spacing: { before: 200, after: 100 }
    })
  );
  
  const table5Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Month', true),
        createCell('Days of Therapy', true),
        createCell('Resident Days', true),
        createCell('AUR', true)
      ]
    })
  ];
  
  data.aur.months.forEach(m => {
    const monthData = data.infectionRatePer1000.months.find(mm => mm.monthLabel === m.month);
    table5Rows.push(
      new TableRow({
        children: [
          createCell(m.month),
          createCell(m.totalDOT.toString()),
          createCell(monthData?.residentDays.toLocaleString() || '0'),
          createCell(m.totalAUR.toFixed(2))
        ]
      })
    );
  });
  
  table5Rows.push(
    new TableRow({
      children: [
        createCell('QUARTER TOTAL', true),
        createCell(data.aur.quarterTotal.totalDOT.toString()),
        createCell(totalResidentDays.toLocaleString()),
        createCell(data.aur.quarterTotal.totalAUR.toFixed(2))
      ]
    })
  );
  
  children.push(
    new Table({
      rows: table5Rows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }),
    new Paragraph({
      children: [new TextRun({ text: `National Benchmark AUR: 71.0 | Your Facility: ${data.aur.quarterTotal.totalAUR.toFixed(2)}`, ...TABLE_CELL_STYLE, italics: true })],
      spacing: { before: 100, after: 300 }
    })
  );
  
  // ACT Section
  children.push(...createPDCASection('ACT - Interventions & Next Steps', [
    '[Add specific interventions based on data analysis]',
    '[Document any policy or procedure changes needed]',
    '[Identify staff education needs]',
    '[Set goals for next quarter]'
  ]));
  
  // Executive Summary
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'EXECUTIVE SUMMARY', ...HEADING_STYLE })],
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Total New Infections: ${data.executiveSummary.totalNewInfections} (Previous: ${data.executiveSummary.previousTotalInfections})`, ...NORMAL_STYLE })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Infection Rate: ${data.executiveSummary.infectionRateByCensus.toFixed(2)} per 1,000 RD (Previous: ${data.executiveSummary.previousInfectionRate.toFixed(2)})`, ...NORMAL_STYLE })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Total ABT Starts: ${data.executiveSummary.totalABTStarts} (Previous: ${data.executiveSummary.previousABTStarts})`, ...NORMAL_STYLE })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Total Days of Therapy: ${data.executiveSummary.totalDOT} (Previous: ${data.executiveSummary.previousDOT})`, ...NORMAL_STYLE })],
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Analysis & Recommendations:', ...SUBHEADING_STYLE })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: '[Add your analysis and recommendations here]', ...NORMAL_STYLE, italics: true })],
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${format(new Date(), 'MMMM d, yyyy')} | ${data.facilityName}`, size: 16, font: 'Arial', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    })
  );
  
  return new Document({
    sections: [{
      properties: {},
      children
    }]
  });
};

// =====================================================
// QAPI IP (PRECAUTIONS) WORD DOCUMENT
// =====================================================

export const buildQAPIIPDocx = (data: QAPIIPReportData): Document => {
  const children: (Paragraph | Table)[] = [];
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'QAPI REPORT: INFECTION PREVENTION (PRECAUTIONS)', ...TITLE_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `${data.quarter} ${data.year} | ${data.facilityName}`, ...NORMAL_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Surveillance Period: ${data.periodRange}`, ...NORMAL_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );
  
  // PLAN Section
  children.push(...createPDCASection('PLAN', [
    'Goal: Ensure appropriate isolation precautions and reduce transmission risk',
    'Monitor precaution adherence and duration',
    'Track resolution rates and follow-up compliance'
  ]));
  
  // DO Section
  children.push(...createPDCASection('DO', [
    'Implement precautions based on infection type',
    'Conduct daily precaution rounds',
    'Document PPE compliance and room signage'
  ]));
  
  // CHECK Section - Summary Table
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'CHECK - Precautions Summary', ...SUBHEADING_STYLE, color: '1F4E79' })],
      spacing: { before: 300, after: 200 }
    })
  );
  
  const summaryTable = new Table({
    rows: [
      new TableRow({
        children: [
          createCell('Precaution Type', true),
          createCell('Count', true)
        ]
      }),
      new TableRow({
        children: [createCell('Enhanced Barrier Precautions (EBP)'), createCell(data.precautionsSummary.ebpCount.toString())]
      }),
      new TableRow({
        children: [createCell('Isolation'), createCell(data.precautionsSummary.isolationCount.toString())]
      }),
      new TableRow({
        children: [createCell('Contact'), createCell(data.precautionsSummary.contactCount.toString())]
      }),
      new TableRow({
        children: [createCell('Droplet'), createCell(data.precautionsSummary.dropletCount.toString())]
      }),
      new TableRow({
        children: [createCell('Airborne'), createCell(data.precautionsSummary.airborneCount.toString())]
      }),
      new TableRow({
        children: [createCell('TOTAL ACTIVE', true), createCell(data.precautionsSummary.totalActive.toString())]
      })
    ],
    width: { size: 50, type: WidthType.PERCENTAGE }
  });
  
  children.push(summaryTable);
  
  // Monthly Trends Table
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Monthly Precaution Trends', ...SUBHEADING_STYLE })],
      spacing: { before: 300, after: 100 }
    })
  );
  
  const trendsRows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Month', true),
        createCell('New Cases', true),
        createCell('Resolved', true),
        createCell('Active', true),
        createCell('Avg Days', true)
      ]
    })
  ];
  
  data.monthlyTrends.forEach(m => {
    trendsRows.push(
      new TableRow({
        children: [
          createCell(m.month),
          createCell(m.newCases.toString()),
          createCell(m.resolvedCases.toString()),
          createCell(m.activeCases.toString()),
          createCell(m.avgDaysOnPrecaution.toFixed(1))
        ]
      })
    );
  });
  
  children.push(
    new Table({
      rows: trendsRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Resolution Rate: ${data.resolutionRate.rate.toFixed(1)}% (${data.resolutionRate.resolved} resolved / ${data.resolutionRate.resolved + data.resolutionRate.active} total)`, ...NORMAL_STYLE })],
      spacing: { before: 200, after: 200 }
    })
  );
  
  // ACT Section
  children.push(...createPDCASection('ACT - Interventions & Next Steps', [
    '[Add specific interventions based on data analysis]',
    '[Document any policy or procedure changes needed]',
    '[Identify staff education needs]'
  ]));
  
  // Footer
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${format(new Date(), 'MMMM d, yyyy')} | ${data.facilityName}`, size: 16, font: 'Arial', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    })
  );
  
  return new Document({
    sections: [{
      properties: {},
      children
    }]
  });
};

// =====================================================
// QAPI VACCINATION WORD DOCUMENT
// =====================================================

export const buildQAPIVaxDocx = (data: QAPIVaxReportData): Document => {
  const children: (Paragraph | Table)[] = [];
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'QAPI REPORT: VACCINATION', ...TITLE_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `${data.quarter} ${data.year} | ${data.facilityName}`, ...NORMAL_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Surveillance Period: ${data.periodRange}`, ...NORMAL_STYLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );
  
  // PLAN Section
  children.push(...createPDCASection('PLAN', [
    'Goal: Maximize vaccination coverage for influenza, COVID-19, pneumococcal, and other recommended vaccines',
    'Track declinations and re-offer per regulatory requirements',
    'Monitor coverage rates against CMS benchmarks'
  ]));
  
  // DO Section
  children.push(...createPDCASection('DO', [
    'Offer vaccines per admission and seasonal protocols',
    'Document all declinations with reason',
    'Re-offer declined vaccines per schedule (Flu: 30 days, COVID: 180 days)'
  ]));
  
  // CHECK Section - Coverage Table
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'CHECK - Vaccination Coverage', ...SUBHEADING_STYLE, color: '1F4E79' })],
      spacing: { before: 300, after: 200 }
    })
  );
  
  // Build coverage table from actual data structure
  const vaccineTypes = ['influenza', 'pneumococcal', 'covid', 'tdap', 'other'] as const;
  let totalGiven = 0;
  let totalTotal = 0;
  
  const coverageRows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Vaccine Type', true),
        createCell('Given', true),
        createCell('Total', true),
        createCell('Coverage %', true)
      ]
    })
  ];
  
  vaccineTypes.forEach(type => {
    const stats = data.coverage[type];
    totalGiven += stats.given;
    totalTotal += stats.total;
    coverageRows.push(
      new TableRow({
        children: [
          createCell(type.charAt(0).toUpperCase() + type.slice(1)),
          createCell(stats.given.toString()),
          createCell(stats.total.toString()),
          createCell(stats.rate.toFixed(1) + '%')
        ]
      })
    );
  });
  
  const overallRate = totalTotal > 0 ? (totalGiven / totalTotal) * 100 : 0;
  coverageRows.push(
    new TableRow({
      children: [
        createCell('TOTAL', true),
        createCell(totalGiven.toString()),
        createCell(totalTotal.toString()),
        createCell(overallRate.toFixed(1) + '%')
      ]
    })
  );
  
  children.push(
    new Table({
      rows: coverageRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    })
  );
  
  // Due/Overdue Summary
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Due/Overdue Summary', ...SUBHEADING_STYLE })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Due: ${data.dueOverdue.due} | Overdue: ${data.dueOverdue.overdue} | Total Pending: ${data.dueOverdue.total}`, ...NORMAL_STYLE })],
      spacing: { after: 200 }
    })
  );
  
  // Declination Summary
  if (data.declinations.total > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Declinations', ...SUBHEADING_STYLE })],
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        children: [new TextRun({ text: `Total Declinations: ${data.declinations.total}`, ...NORMAL_STYLE })],
        spacing: { after: 100 }
      })
    );
    
    // By reason table
    if (Object.keys(data.declinations.byReason).length > 0) {
      const reasonsRows: TableRow[] = [
        new TableRow({
          children: [createCell('Reason', true), createCell('Count', true)]
        })
      ];
      
      Object.entries(data.declinations.byReason).forEach(([reason, count]) => {
        reasonsRows.push(
          new TableRow({
            children: [createCell(reason), createCell(count.toString())]
          })
        );
      });
      
      children.push(
        new Table({
          rows: reasonsRows,
          width: { size: 50, type: WidthType.PERCENTAGE }
        })
      );
    }
  }
  
  // Re-offer Tracking
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Re-offer Tracking', ...SUBHEADING_STYLE })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Residents Due for Re-offer: ${data.reofferTracking.dueForReoffer}`, ...NORMAL_STYLE })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Re-offers Completed This Quarter: ${data.reofferTracking.reofferedThisQuarter}`, ...NORMAL_STYLE })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Accepted After Re-offer: ${data.reofferTracking.acceptedAfterReoffer}`, ...NORMAL_STYLE })],
      spacing: { after: 200 }
    })
  );
  
  // Monthly Administration
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Monthly Administration', ...SUBHEADING_STYLE })],
      spacing: { before: 200, after: 100 }
    })
  );
  
  const monthlyRows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Month', true),
        createCell('Given', true),
        createCell('Declined', true),
        createCell('Due', true)
      ]
    })
  ];
  
  data.monthlyAdministration.forEach(m => {
    monthlyRows.push(
      new TableRow({
        children: [
          createCell(m.month),
          createCell(m.given.toString()),
          createCell(m.declined.toString()),
          createCell(m.dueCount.toString())
        ]
      })
    );
  });
  
  children.push(
    new Table({
      rows: monthlyRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    })
  );
  
  // ACT Section
  children.push(...createPDCASection('ACT - Interventions & Next Steps', [
    '[Add specific interventions based on data analysis]',
    '[Document vaccination education efforts]',
    '[Set coverage goals for next quarter]'
  ]));
  
  // Footer
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${format(new Date(), 'MMMM d, yyyy')} | ${data.facilityName}`, size: 16, font: 'Arial', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    })
  );
  
  return new Document({
    sections: [{
      properties: {},
      children
    }]
  });
};
