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

  doc.setFontSize(14);
  doc.text(COMPANY.name, 14, 16);
  doc.setFontSize(9);
  doc.text(COMPANY.address, 14, 22);

  doc.setFontSize(12);
  doc.text(title, 14, 32);
  doc.setFontSize(8);
  doc.text(`Generated on ${new Date().toLocaleString()} by ${generatedBy}`, 14, 38);

  autoTable(doc, {
    startY: 43,
    head: [header],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 34, 49] },
  });

  doc.save(filename);
}
