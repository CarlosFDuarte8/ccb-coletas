import type { ReportData } from "./report";

function money(valueInCents: number) {
  return valueInCents / 100;
}

function brl(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(money(valueInCents));
}

function safeText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function fileBase(report: ReportData) {
  const scope = report.scopeLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `relatorio-${scope}-${report.filters.from}-a-${report.filters.to}`;
}

function download(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportReportCsv(report: ReportData) {
  const rows = [
    ["Tipo", "Competência", "Data", "Setor", "Igreja", "Código", "Reunião/Categoria", "Comprovante", "Valor"],
    ...report.collections.map((item) => ["Coleta", item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), `${item.meetingType === "rjm" ? "RJM" : "Culto"} / ${item.collectionType}`, "", money(item.amountInCents).toFixed(2).replace(".", ",")]),
    ...report.deposits.map((item) => ["Depósito", item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), "Confirmado", safeText(item.transactionNumber), money(item.amountInCents).toFixed(2).replace(".", ",")]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  download(`\uFEFF${csv}`, "text/csv;charset=utf-8", `${fileBase(report)}.csv`);
}

export async function exportReportExcel(report: ReportData) {
  const { createXlsx } = await import("@litejs/xlsx");
  const header = (values: string[]) => values.map((value) => ({ value, style: "header" }));
  const content = await createXlsx({
    styles: {
      header: { font: { b: true }, fill: "DDEFE6", border: "B9D8C8" },
      title: { font: { b: true, sz: 14 }, fill: "177A51" },
    },
    sheets: [
      {
        name: "Resumo",
        cols: "28,22",
        data: [
          [{ value: "CCB Coletas - Relatório", style: "title" }],
          ["Escopo", report.scopeLabel],
          ["Período", `${report.filters.from} a ${report.filters.to}`],
          ["Total coletado", money(report.totals.collectedInCents)],
          ["Total depositado", money(report.totals.depositedInCents)],
          ["Saldo", money(report.totals.balanceInCents)],
          ["Média mensal", money(report.totals.averagePerMonthInCents)],
          ["Coletas registradas", report.totals.collectionsCount],
          ["Coletas sem arrecadação", report.totals.zeroCollectionsCount],
        ],
      },
      {
        name: "Evolução mensal",
        freeze: { rows: 1 },
        cols: "16,18,18,18,14",
        data: [header(["Competência", "Coletado", "Depositado", "Saldo", "Coletas"]), ...report.months.map((item) => [item.competency, money(item.collectedInCents), money(item.depositedInCents), money(item.balanceInCents), item.collectionsCount])],
      },
      {
        name: "Coletas",
        freeze: { rows: 1 },
        cols: "14,14,20,24,14,14,14,18",
        data: [header(["Competência", "Data", "Setor", "Igreja", "Código", "Reunião", "Tipo", "Valor"]), ...report.collections.map((item) => [item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), item.meetingType === "rjm" ? "RJM" : "Culto", item.collectionType, money(item.amountInCents)])],
      },
      {
        name: "Depósitos",
        freeze: { rows: 1 },
        cols: "14,14,20,24,14,20,18",
        data: [header(["Competência", "Data", "Setor", "Igreja", "Código", "Comprovante", "Valor"]), ...report.deposits.map((item) => [item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), safeText(item.transactionNumber), money(item.amountInCents)])],
      },
    ],
  });
  download(Uint8Array.from(content).buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${fileBase(report)}.xlsx`);
}

export async function exportReportPdf(report: ReportData) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CCB Coletas - Relatorio financeiro", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${report.scopeLabel} | ${report.filters.from} a ${report.filters.to}`, 14, 23);
  doc.text(`Coletado: ${brl(report.totals.collectedInCents)}   Depositado: ${brl(report.totals.depositedInCents)}   Saldo: ${brl(report.totals.balanceInCents)}`, 14, 29);
  autoTable(doc, {
    startY: 35,
    head: [["Competência", "Coletado", "Depositado", "Saldo", "Normal", "Especial", "Culto", "RJM", "Registros"]],
    body: report.months.map((item) => [item.competency, brl(item.collectedInCents), brl(item.depositedInCents), brl(item.balanceInCents), brl(item.normalInCents), brl(item.specialInCents), brl(item.cultoInCents), brl(item.rjmInCents), String(item.collectionsCount)]),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [23, 122, 81] },
    alternateRowStyles: { fillColor: [244, 248, 246] },
  });
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detalhamento das coletas", 14, 15);
  autoTable(doc, {
    startY: 20,
    head: [["Competência", "Data", "Setor", "Igreja", "Reunião", "Tipo", "Valor"]],
    body: report.collections.map((item) => [item.competency, item.date, item.sectorName, item.churchName, item.meetingType === "rjm" ? "RJM" : "Culto", item.collectionType, brl(item.amountInCents)]),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [23, 122, 81] },
  });
  doc.save(`${fileBase(report)}.pdf`);
}
