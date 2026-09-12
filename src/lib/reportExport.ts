import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

function escapeCsv(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// A company/date/generated-by preamble shown on every exported report, so a
// printed copy is self-identifying without the app around it.
export function downloadReportCsv({
  filename,
  title,
  header,
  rows,
  generatedBy,
}: {
  filename: string;
  title: string;
  header: string[];
  rows: string[][];
  generatedBy: string;
}) {
  const preamble = [
    [COMPANY.name],
    [COMPANY.address],
    [`GSTIN: ${COMPANY.gstin}`],
    [title],
    [`Generated on ${new Date().toLocaleString()} by ${generatedBy}`],
    [],
  ];
  const csv = [...preamble, header, ...rows]
    .map((row) => row.map((v) => escapeCsv(String(v))).join(","))
    .join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function downloadReportPdf({
  filename,
  title,
  header,
  rows,
  generatedBy,
}: {
  filename: string;
  title: string;
  header: string[];
  rows: string[][];
  generatedBy: string;
}) {
  const doc = new jsPDF({ orientation: rows.length && header.length > 5 ? "landscape" : "portrait" });
  const marginX = 14;
  // The company address can run long enough to wrap — measure its actual
  // wrapped line count instead of assuming a fixed number of lines, so
  // everything below it (GSTIN, title, table) never overlaps it.
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;

  let y = 16;
  doc.setFontSize(14);
  doc.text(COMPANY.name, marginX, y);
  y += 6;

  doc.setFontSize(9);
  const addressLines = doc.splitTextToSize(COMPANY.address, maxWidth);
  doc.text(addressLines, marginX, y);
  y += addressLines.length * 4.5 + 4;

  doc.text(`GSTIN: ${COMPANY.gstin}`, marginX, y);
  y += 8;

  doc.setFontSize(12);
  doc.text(title, marginX, y);
  y += 6;
  doc.setFontSize(8);
  doc.text(`Generated on ${new Date().toLocaleString()} by ${generatedBy}`, marginX, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [header],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 34, 49] },
  });

  doc.save(filename);
}
