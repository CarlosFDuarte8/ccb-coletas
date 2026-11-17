import { reportBasisLabel, type ReportData } from "./report";
import { paymentMethodLabel, paymentSourceLabel } from "@/lib/domain/expense";

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
  return `relatorio-${report.filters.basis ?? "competency"}-${report.filters.content}-${scope}-${report.filters.from}-a-${report.filters.to}`;
}

function download(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildReportCsv(report: ReportData) {
  const rows = [
    ["Tipo", "Competência", "Data", "Setor", "Igreja", "Código", "Reunião/Categoria", "Comprovante", "Valor", "Reserva local", "Para administração"],
    ...report.collections.map((item) => ["Coleta", item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), `${item.meetingType === "rjm" ? "RJM" : "Culto"} / ${item.collectionType}`, "", money(item.amountInCents).toFixed(2).replace(".", ","), money(item.maintenanceCashInCents).toFixed(2).replace(".", ","), money(item.amountInCents - item.maintenanceCashInCents).toFixed(2).replace(".", ",")]),
    ...report.deposits.map((item) => ["Depósito", item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), "Confirmado", safeText(item.transactionNumber), money(item.amountInCents).toFixed(2).replace(".", ","), "", ""]),
    ...report.expenses.map((item) => ["Despesa", item.competency, report.filters.basis === "cash" ? item.paymentDate : item.dueDate, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), safeText(`${item.status === "paid" ? "Paga" : "Pendente"} / ${paymentSourceLabel(item.paymentSource)} / ${paymentMethodLabel(item.paymentMethod)} / ${item.category} / ${item.description} / pagamento: ${item.paymentDate || "-"}`), safeText(item.documentNumber), money(item.amountInCents).toFixed(2).replace(".", ","), "", ""]),
  ];
  const csv = rows.map((row, index) => [...row, index === 0 ? "Visão financeira" : reportBasisLabel(report.filters.basis)].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return `\uFEFF${csv}`;
}

export function exportReportCsv(report: ReportData) {
  download(buildReportCsv(report), "text/csv;charset=utf-8", `${fileBase(report)}.csv`);
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
          ["Visão financeira", reportBasisLabel(report.filters.basis)],
          ["Período", `${report.filters.from} a ${report.filters.to}`],
          ["Saldo local de manutenção no fim do período", money(report.totals.maintenanceBalanceInCents)],
          ["Pagamentos do caixa local no período", money(report.totals.maintenanceSpentInCents)],
          ...(report.filters.content !== "expenses" ? [["Total coletado", money(report.totals.collectedInCents)], ["Total depositado", money(report.totals.depositedInCents)], ["A depositar", money(report.totals.balanceInCents)], ["Coletas registradas", report.totals.collectionsCount]] : []),
          ...(report.filters.content !== "collections" ? [["Total de despesas", money(report.totals.expensesInCents)], ["Total pago", money(report.totals.paidExpensesInCents)], ["Total pendente", money(report.totals.pendingExpensesInCents)]] : []),
          ...(report.filters.content === "complete" ? [["Resultado líquido", money(report.totals.netResultInCents)]] : []),
        ],
      },
      {
        name: "Evolução mensal",
        freeze: { rows: 1 },
        cols: report.filters.content === "complete" ? "16,18,18,18,18,18,14" : "16,18,18,18,14",
        data: report.filters.content === "expenses"
          ? [header(["Período", "Despesas", "Pago", "Pendente", "Contas"]), ...report.months.map((item) => [item.competency, money(item.expensesInCents), money(item.paidExpensesInCents), money(item.pendingExpensesInCents), item.expensesCount])]
          : report.filters.content === "collections"
            ? [header(["Período", "Coletado", "Depositado", "A depositar", "Coletas"]), ...report.months.map((item) => [item.competency, money(item.collectedInCents), money(item.depositedInCents), money(item.balanceInCents), item.collectionsCount])]
            : [header(["Período", "Coletado", "Despesas", "Resultado", "Depositado", "A depositar", "Coletas"]), ...report.months.map((item) => [item.competency, money(item.collectedInCents), money(item.expensesInCents), money(item.netResultInCents), money(item.depositedInCents), money(item.balanceInCents), item.collectionsCount])],
      },
      report.filters.content !== "expenses" ? {
        name: "Coletas",
        freeze: { rows: 1 },
        cols: "14,14,20,24,14,14,14,18,18,18",
        data: [header(["Competência", "Data", "Setor", "Igreja", "Código", "Reunião", "Tipo", "Valor", "Reserva local", "Para administração"]), ...report.collections.map((item) => [item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), item.meetingType === "rjm" ? "RJM" : "Culto", item.collectionType, money(item.amountInCents), money(item.maintenanceCashInCents), money(item.amountInCents - item.maintenanceCashInCents)])],
      } : null,
      report.filters.content !== "expenses" ? {
        name: "Depósitos",
        freeze: { rows: 1 },
        cols: "14,14,20,24,14,20,18",
        data: [header(["Competência", "Data", "Setor", "Igreja", "Código", "Comprovante", "Valor"]), ...report.deposits.map((item) => [item.competency, item.date, safeText(item.sectorName), safeText(item.churchName), safeText(item.churchCode), safeText(item.transactionNumber), money(item.amountInCents)])],
      } : null,
      report.filters.content !== "collections" ? {
        name: "Despesas",
        freeze: { rows: 1 },
        cols: "14,14,14,14,20,24,20,18,30,24,18,18",
        data: [header(["Referência", "Vencimento", "Pagamento", "Status", "Origem", "Setor", "Igreja", "Forma", "Categoria", "Descrição", "Pago a", "Documento", "Valor"]), ...report.expenses.map((item) => [item.competency, item.dueDate, item.paymentDate, item.status === "paid" ? "Paga" : "Pendente", paymentSourceLabel(item.paymentSource), safeText(item.sectorName), safeText(item.churchName), paymentMethodLabel(item.paymentMethod), safeText(item.category), safeText(item.description), safeText(item.payee), safeText(item.documentNumber), money(item.amountInCents)])],
      } : null,
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
  doc.text(`${report.scopeLabel} | ${report.filters.from} a ${report.filters.to} | ${reportBasisLabel(report.filters.basis)}`, 14, 23);
  const summaryLine = report.filters.content === "expenses"
    ? `Despesas: ${brl(report.totals.expensesInCents)}   Pago: ${brl(report.totals.paidExpensesInCents)}   Pendente: ${brl(report.totals.pendingExpensesInCents)}`
    : report.filters.content === "collections"
      ? `Coletado: ${brl(report.totals.collectedInCents)}   Depositado: ${brl(report.totals.depositedInCents)}   A depositar: ${brl(report.totals.balanceInCents)}`
      : `Coletado: ${brl(report.totals.collectedInCents)}   Despesas: ${brl(report.totals.expensesInCents)}   Resultado: ${brl(report.totals.netResultInCents)}   Depositado: ${brl(report.totals.depositedInCents)}`;
  doc.text(summaryLine, 14, 29);
  autoTable(doc, report.filters.content === "expenses" ? {
    startY: 35,
    head: [["Período", "Despesas", "Pago", "Pendente", "Contas"]],
    body: report.months.map((item) => [item.competency, brl(item.expensesInCents), brl(item.paidExpensesInCents), brl(item.pendingExpensesInCents), String(item.expensesCount)]),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [217, 154, 56] },
    alternateRowStyles: { fillColor: [252, 248, 240] },
  } : report.filters.content === "collections" ? {
    startY: 35,
    head: [["Período", "Coletado", "Depositado", "A depositar", "Registros"]],
    body: report.months.map((item) => [item.competency, brl(item.collectedInCents), brl(item.depositedInCents), brl(item.balanceInCents), String(item.collectionsCount)]),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [23, 122, 81] },
    alternateRowStyles: { fillColor: [244, 248, 246] },
  } : {
    startY: 35,
    head: [["Período", "Coletado", "Despesas", "Resultado", "Depositado", "A depositar", "Normal", "Especial", "Registros"]],
    body: report.months.map((item) => [item.competency, brl(item.collectedInCents), brl(item.expensesInCents), brl(item.netResultInCents), brl(item.depositedInCents), brl(item.balanceInCents), brl(item.normalInCents), brl(item.specialInCents), String(item.collectionsCount)]),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [23, 122, 81] },
    alternateRowStyles: { fillColor: [244, 248, 246] },
  });
  if (report.filters.content !== "expenses") {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Detalhamento das coletas", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [["Competência", "Data", "Setor", "Igreja", "Reunião", "Tipo", "Valor", "Reserva local", "Administração"]],
      body: report.collections.map((item) => [item.competency, item.date, item.sectorName, item.churchName, item.meetingType === "rjm" ? "RJM" : "Culto", item.collectionType, brl(item.amountInCents), brl(item.maintenanceCashInCents), brl(item.amountInCents - item.maintenanceCashInCents)]),
      styles: { fontSize: 7.5, cellPadding: 2.2 },
      headStyles: { fillColor: [23, 122, 81] },
    });
  }
  if (report.expenses.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Detalhamento das despesas", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [["Referência", "Vencimento", "Pagamento", "Status", "Igreja", "Origem / forma / categoria", "Descrição", "Valor"]],
      body: report.expenses.map((item) => [item.competency, item.dueDate, item.paymentDate || "-", item.status === "paid" ? "Paga" : "Pendente", item.churchName, `${paymentSourceLabel(item.paymentSource)} / ${paymentMethodLabel(item.paymentMethod)} / ${item.category}`, item.description, brl(item.amountInCents)]),
      styles: { fontSize: 7.5, cellPadding: 2.2 },
      headStyles: { fillColor: [217, 154, 56] },
    });
  }
  doc.addPage();
  doc.setFontSize(12);
  doc.text("Caixa local de manutencao preventiva", 14, 15);
  autoTable(doc, { startY: 20, head: [["Mes", "Saldo anterior", "Entradas locais", "Pagamentos locais", "Saldo acumulado"]],
    body: report.months.map((month) => [month.competency, brl(month.maintenanceOpeningInCents), brl(month.maintenanceIncomingInCents), brl(month.maintenanceSpentInCents), brl(month.maintenanceBalanceInCents)]),
    styles: { fontSize: 8 }, headStyles: { fillColor: [23, 122, 81] } });
  doc.save(`${fileBase(report)}.pdf`);
}
