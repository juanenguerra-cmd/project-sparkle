import type jsPDF from 'jspdf';

export const drawLabeledLineField = (
  doc: jsPDF,
  opts: { x: number; y: number; width: number; label: string; value?: string }
) => {
  const { x, y, width, label, value } = opts;

  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y);

  // Underline field
  const labelWidth = doc.getTextWidth(label);
  const fieldX = x + labelWidth + 4;
  const fieldEndX = x + width;
  doc.setLineWidth(1);
  doc.line(fieldX, y + 2, fieldEndX, y + 2);

  if (value) {
    doc.setFont('helvetica', 'normal');
    doc.text(value, fieldX + 2, y);
  }
};
