import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport } from "../lib/reports/report";
import { buildReportCsv } from "../lib/reports/export";
import { maintenanceStatement } from "../lib/domain/maintenance-account";
import type { AppDatabase } from "../lib/domain/types";

export function financialFixture(): AppDatabase {
  const timestamp = "2026-11-01T10:00:00Z";
  return { version: 8, appliedSeeds: [], sectors: [{ id: "sector-a", name: "Setor A", createdAt: timestamp, updatedAt: timestamp }],
    churches: [{ id: "church-a", sectorId: "sector-a", name: "Igreja A", code: "A", address: "", latitude: "", longitude: "", contacts: [], active: true, createdAt: timestamp, updatedAt: timestamp }],
    collections: [{ id: "collection-a", churchId: "church-a", competency: "2026-11", date: "2026-11-01", meetingType: "culto", collectionType: "normal", amountInCents: 10000, notes: "", breakdown: { pietyInCents: 0, maintenanceInCents: 3000, constructionInCents: 0, missionsInCents: 0, othersInCents: 7000 }, maintenanceCashInCents: 3000, createdAt: timestamp, updatedAt: timestamp }],
    deposits: [{ id: "deposit-a", churchId: "church-a", competency: "2026-11", date: "2026-12-02", transactionNumber: "ABC", amountInCents: 7000, denominationCounts: {}, notes: "", status: "confirmed", confirmedAt: timestamp, createdAt: timestamp, updatedAt: timestamp }],
    expenses: [{ id: "expense-a", churchId: "church-a", competency: "2026-11", dueDate: "2026-12-05", paymentDate: "2026-12-05", status: "paid", paymentSource: "maintenance_cash", paymentMethod: "pix", description: "Energia de novembro", category: "Energia", amountInCents: 2000, payee: "", documentNumber: "", notes: "", createdAt: timestamp, updatedAt: timestamp }],
    competencies: [], serviceSchedules: [], scheduleExceptions: [] };
}

const base = { scope: "general" as const, scopeId: "", content: "complete" as const };

test("competência reconhece a conta de novembro mesmo quando paga em dezembro", () => {
  const november = buildReport(financialFixture(), { ...base, from: "2026-11", to: "2026-11", basis: "competency" });
  const december = buildReport(financialFixture(), { ...base, from: "2026-12", to: "2026-12", basis: "competency" });
  assert.equal(november.totals.expensesInCents, 2000);
  assert.equal(december.totals.expensesInCents, 0);
  assert.equal(november.totals.balanceInCents, 0);
});

test("caixa reconhece pagamento e depósito no mês da movimentação", () => {
  const november = buildReport(financialFixture(), { ...base, from: "2026-11", to: "2026-11", basis: "cash" });
  const december = buildReport(financialFixture(), { ...base, from: "2026-12", to: "2026-12", basis: "cash" });
  assert.equal(november.totals.expensesInCents, 0);
  assert.equal(november.totals.depositedInCents, 0);
  assert.equal(november.totals.balanceInCents, 7000);
  assert.equal(december.totals.expensesInCents, 2000);
  assert.equal(december.totals.depositedInCents, 7000);
  assert.equal(december.totals.balanceInCents, 0);
});

test("caixa local transporta saldo e deduz apenas despesas locais pagas", () => {
  const database = financialFixture();
  assert.deepEqual(maintenanceStatement(database, "church-a", "2026-12-01", "2026-12-31"), { openingInCents: 3000, incomingInCents: 0, outgoingInCents: 2000, balanceInCents: 1000 });
  database.expenses[0].paymentSource = "administration_account";
  assert.equal(maintenanceStatement(database, "church-a", "2026-12-01", "2026-12-31").balanceInCents, 3000);
});

test("conta pendente aparece por competência e não compõe saídas de caixa", () => {
  const database = financialFixture(); database.expenses[0].status = "pending"; database.expenses[0].paymentDate = "";
  assert.equal(buildReport(database, { ...base, from: "2026-11", to: "2026-11" }).totals.pendingExpensesInCents, 2000);
  assert.equal(buildReport(database, { ...base, from: "2026-11", to: "2026-12", basis: "cash" }).totals.expensesInCents, 0);
  assert.equal(maintenanceStatement(database, "church-a", "2026-12-01", "2026-12-31").balanceInCents, 3000);
});

test("depósito estornado fica fora dos totais e mantém a diferença a conciliar", () => {
  const database = financialFixture(); database.deposits[0].status = "reversed";
  const report = buildReport(database, { ...base, from: "2026-11", to: "2026-12" });
  assert.equal(report.deposits.length, 0);
  assert.equal(report.totals.depositedInCents, 0);
  assert.equal(report.totals.balanceInCents, 7000);
});

test("exportação identifica a visão financeira selecionada e preserva a referência", () => {
  const report = buildReport(financialFixture(), { ...base, from: "2026-12", to: "2026-12", basis: "cash" });
  const csv = buildReportCsv(report);
  assert.match(csv, /Visão financeira/);
  assert.match(csv, /Caixa:/);
  assert.match(csv, /2026-11/);
  assert.match(csv, /2026-12-05/);
});

test("exportação detalha a parcela local e o valor destinado à administração", () => {
  const csv = buildReportCsv(buildReport(financialFixture(), { ...base, from: "2026-11", to: "2026-11" }));
  assert.match(csv, /"Reserva local";"Para administração"/);
  assert.match(csv, /"30,00";"70,00"/);
});
