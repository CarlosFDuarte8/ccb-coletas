"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDatabase } from "@/hooks/use-database";
import { useChurchSelection } from "@/components/churches/church-selection-provider";
import { formatCurrency } from "@/lib/domain/money";
import { buildReport } from "@/lib/reports/report";
import { buildMonthlySchedule } from "@/lib/domain/schedule";
import { BanknoteIcon, BuildingIcon, PackageIcon, ReceiptIcon } from "@/components/icons";

export function FinancialOverview() {
  const database = useDatabase();
  const { church, churchId, competency, user, canWrite } = useChurchSelection();
  const report = useMemo(() => buildReport(database, { scope: "church", scopeId: churchId, from: competency, to: competency, content: "complete", basis: "competency" }), [database, churchId, competency]);
  const cash = useMemo(() => buildReport(database, { scope: "church", scopeId: churchId, from: competency, to: competency, content: "complete", basis: "cash" }), [database, churchId, competency]);
  const schedule = useMemo(() => buildMonthlySchedule(churchId, competency, database.serviceSchedules, database.scheduleExceptions), [churchId, competency, database.serviceSchedules, database.scheduleExceptions]);
  const drafts = database.deposits.filter((item) => item.churchId === churchId && item.competency === competency && item.status === "draft");
  const month = database.competencies.find((item) => item.churchId === churchId && item.competency === competency);
  const totals = report.totals;
  const recent = [...report.collections].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const date = (value: string) => value.split("-").reverse().join("/");
  const metrics = [
    { label: "Arrecadação da competência", value: formatCurrency(totals.collectedInCents), detail: `${totals.collectionsCount} coletas registradas`, icon: PackageIcon },
    { label: "A depositar à administração", value: formatCurrency(totals.balanceInCents), detail: "Coletas menos reserva local e depósitos confirmados", icon: BanknoteIcon },
    { label: "Saldo local de manutenção", value: formatCurrency(totals.maintenanceBalanceInCents), detail: "Saldo acumulado até o fim do mês selecionado", icon: BuildingIcon },
    { label: "Despesas da competência", value: formatCurrency(totals.expensesInCents), detail: "Mês de referência das contas", icon: ReceiptIcon },
    { label: "Pagamentos no mês", value: formatCurrency(cash.totals.paidExpensesInCents), detail: "Pela data do pagamento, incluindo contas de outros meses", icon: BanknoteIcon },
    { label: "A pagar da competência", value: formatCurrency(totals.pendingExpensesInCents), detail: `${totals.pendingExpensesCount} contas pendentes`, icon: ReceiptIcon },
  ];
  return <div className="page-container">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Visão geral</p><h1 className="mt-1 text-2xl font-semibold text-foreground">Olá, {user.name.split(" ")[0]}</h1><p className="mt-2 text-sm text-muted">{church?.name ?? "Selecione uma igreja"} · {competency.split("-").reverse().join("/")} · {month?.status === "closed" ? "Competência fechada" : "Competência aberta"}</p></div><div className="flex gap-2">{canWrite && user.menus.includes("collections") && <Link className="button-primary" href="/coletas">Registrar coleta</Link>}{canWrite && user.menus.includes("expenses") && <Link className="button-secondary" href="/despesas">Registrar despesa</Link>}</div></section>
    <section aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(({ label, value, detail, icon: Icon }) => <article className="metric-card" key={label}><div className="metric-icon metric-icon-brand"><Icon className="size-5" /></div><p className="mt-4 text-sm text-muted">{label}</p><p className="mt-1 text-2xl font-semibold text-foreground">{value}</p><p className="mt-2 text-xs text-muted">{detail}</p></article>)}</section>
    <section className="grid items-start gap-4 xl:grid-cols-2"><article className="panel p-5"><h2 className="panel-title">Conferência do mês</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted">Depósitos em rascunho</dt><dd>{drafts.length}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Destinado ao caixa local neste mês</dt><dd>{formatCurrency(totals.reservedMaintenanceCashInCents)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Pagamentos do caixa local no mês</dt><dd>{formatCurrency(totals.maintenanceSpentInCents)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Eventos previstos na programação</dt><dd>{schedule.length}</dd></div></dl>{user.menus.includes("reports") && <Link className="button-secondary mt-5" href="/relatorios">Consultar relatórios</Link>}</article>
    <article className="panel p-5"><h2 className="panel-title">Últimas coletas da competência</h2><div className="mt-4 divide-y divide-border">{recent.map((item) => <div className="flex justify-between gap-3 py-3 text-sm" key={item.id}><span className="text-muted">{date(item.date)} · {item.meetingType === "rjm" ? "RJM" : "Culto"}</span><strong>{formatCurrency(item.amountInCents)}</strong></div>)}{recent.length === 0 && <p className="py-4 text-sm text-muted">Nenhuma coleta registrada nesta competência.</p>}</div></article></section>
  </div>;
}
