import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType } from 'docx';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// Official Header constants based on user requirements
export const OFFICIAL_HEADER = {
  country: 'الجمهورية اليمنية',
  ministry: 'وزارة الداخلية',
  sector: 'قطاع استخبارات الشرطة',
  branch: 'فرع مصلحة الجوازات',
};

/**
 * Common export utilities for the application.
 */

export const exportToExcel = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportToImage = async (elementId: string, fileName: string) => {
  const node = document.getElementById(elementId);
  if (!node) return;
  
  const dataUrl = await toPng(node, { backgroundColor: '#fff' });
  saveAs(dataUrl, `${fileName}.png`);
};

export const exportToPDF = async (elementId: string, fileName: string) => {
  const node = document.getElementById(elementId);
  if (!node) return;

  const dataUrl = await toPng(node, { backgroundColor: '#fff', quality: 0.95 });
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgProps = pdf.getImageProperties(dataUrl);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  
  pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${fileName}.pdf`);
};

export const exportToWord = async (title: string, data: Record<string, any>, fileName: string) => {
  const doc = new Document({
    sections: [
      {
        properties: {
          textDirection: 'rtl' as any,
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: OFFICIAL_HEADER.country, bold: true, size: 28 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: OFFICIAL_HEADER.ministry, size: 24 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: OFFICIAL_HEADER.sector, size: 22 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: OFFICIAL_HEADER.branch, size: 22 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "", spacing: { after: 400 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 32,
                underline: {},
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: Object.entries(data).map(([key, value]) => (
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: String(value || '-'), alignment: AlignmentType.RIGHT })],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: key, bold: true, alignment: AlignmentType.RIGHT })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                ],
              })
            )),
          }),
          new Paragraph({ text: "", spacing: { before: 800 } }),
          new Paragraph({
            children: [
              new TextRun({ text: `تاريخ التصدير: ${new Date().toLocaleDateString('ar-YE')}`, size: 18 }),
            ],
            alignment: AlignmentType.LEFT,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
};

export const handlePrint = () => {
  window.print();
};
