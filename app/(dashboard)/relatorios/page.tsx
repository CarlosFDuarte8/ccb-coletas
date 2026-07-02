"use client";

import { useMemo, useState } from "react";
import { BanknoteIcon, BuildingIcon, ChartIcon, DownloadIcon, PackageIcon, ReceiptIcon } from "@/components/icons";
import { ChurchRankingChart, DistributionChart, EvolutionChart } from "@/components/reports/charts";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDatabase } from "@/hooks/use-database";
import { formatCurrency } from "@/lib/domain/money";
import { exportReportCsv, exportReportExcel, exportReportPdf } from "@/lib/reports/export";
import { buildReport, type ReportScope } from "@/lib/reports/report";

type Exporting = "pdf" | "excel" | "csv" | null;

function defaultPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${year}-01`, to: `${year}-${month}` };
}

export default function ReportsPage() {
  const database = useDatabase();
  const initialPeriod = defaultPeriod();
  const [scope, setScope] = useState<ReportScope>("general");
  const [scopeId, setScopeId] = useState("");
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [exporting, setExporting] = useState<Exporting>(null);
  const [exportError, setExportError] = useState("");
  const invalidPeriod = from > to;
  const report = useMemo(() => buildReport(database, { scope, scopeId, from, to }), [database, scope, scopeId, from, to]);
  const hasData = report.collections.length > 0 || report.deposits.length > 0;

  function changeScope(nextScope: ReportScope) {
    setScope(nextScope);
    setScopeId(nextScope === "sector" ? database.sectors[0]?.id ?? "" : nextScope === "church" ? database.churches[0]?.id ?? "" : "");
  }

  async function runExport(type: Exclude<Exporting, null>) {
    setExporting(type);
    setExportError("");
    try {
      if (type === "pdf") await exportReportPdf(report);
      if (type === "excel") await exportReportExcel(report);
      if (type === "csv") exportReportCsv(report);
    } catch {
      setExportError("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="page-container">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="eyebrow">Análises</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Relatórios financeiros</h1><p className="mt-2 max-w-2xl text-sm text-muted">Compare competências, igrejas e setores com exportações baseadas nos filtros atuais.</p></div>
        <div className="flex flex-wrap gap-2">
          <ExportButton disabled={!hasData || invalidPeriod || exporting !== null} label="PDF" loading={exporting === "pdf"} onClick={() => runExport("pdf")} />
          <ExportButton disabled={!hasData || invalidPeriod || exporting !== null} label="Excel" loading={exporting === "excel"} onClick={() => runExport("excel")} />
          <ExportButton disabled={!hasData || invalidPeriod || exporting !== null} label="CSV" loading={exporting === "csv"} onClick={() => runExport("csv")} />
        </div>
      </section>
      {exportError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{exportError}</p>}

      <section className="panel p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="field-label">Visualizar por<select className="form-control" onChange={(event) => changeScope(event.target.value as ReportScope)} value={scope}><option value="general">Visão geral</option><option value="sector">Setor</option><option value="church">Igreja</option></select></label>
          {scope === "sector" && <label className="field-label">Setor<SearchableSelect onChange={(value) => { if (value) setScopeId(value); }} options={database.sectors.map((sector) => ({ value: sector.id, label: sector.name, description: `${database.churches.filter((church) => church.sectorId === sector.id).length} igreja(s)` }))} placeholder="Buscar setor..." value={scopeId} /></label>}
          {scope === "church" && <label className="field-label">Igreja<SearchableSelect onChange={(value) => { if (value) setScopeId(value); }} options={database.churches.map((church) => ({ value: church.id, label: church.name, description: `${church.code} · ${database.sectors.find((sector) => sector.id === church.sectorId)?.name}` }))} placeholder="Buscar igreja..." value={scopeId} /></label>}
          {scope === "general" && <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2.5"><p className="text-[11px] text-muted">Escopo atual</p><p className="mt-1 text-sm font-semibold text-foreground">Todas as igrejas</p></div>}
          <label className="field-label">Competência inicial<input className="form-control" onChange={(event) => setFrom(event.target.value)} type="month" value={from} /></label>
          <label className="field-label">Competência final<input className="form-control" onChange={(event) => setTo(event.target.value)} type="month" value={to} /></label>
        </div>
        {invalidPeriod && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">A competência inicial não pode ser posterior à final.</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail={`${report.totals.collectionsCount} coletas`} icon={PackageIcon} label="Total coletado" tone="brand" value={formatCurrency(report.totals.collectedInCents)} />
        <MetricCard detail={`${report.deposits.length} comprovantes`} icon={BanknoteIcon} label="Total depositado" tone="blue" value={formatCurrency(report.totals.depositedInCents)} />
        <MetricCard detail="Diferença no período" icon={ReceiptIcon} label="Saldo" tone={report.totals.balanceInCents === 0 ? "green" : "amber"} value={formatCurrency(report.totals.balanceInCents)} />
        <MetricCard detail={`${report.totals.zeroCollectionsCount} sem arrecadação`} icon={ChartIcon} label="Média mensal" tone="green" value={formatCurrency(report.totals.averagePerMonthInCents)} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <article className="panel p-4 sm:p-5"><div className="mb-5"><h2 className="panel-title">Evolução mensal</h2><p className="panel-description">Coletado e depositado por competência</p></div><EvolutionChart months={report.months} /></article>
        <article className="panel p-4 sm:p-5"><div className="mb-5"><h2 className="panel-title">Composição das coletas</h2><p className="panel-description">Normal, especial, cultos e RJM</p></div><DistributionChart cultoInCents={report.totals.cultoInCents} normalInCents={report.totals.normalInCents} rjmInCents={report.totals.rjmInCents} specialInCents={report.totals.specialInCents} /></article>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-2">
        <article className="panel p-4 sm:p-5"><div className="mb-5"><h2 className="panel-title">Ranking por igreja</h2><p className="panel-description">Arrecadação dentro do escopo selecionado</p></div><ChurchRankingChart churches={report.churches} /></article>
        <article className="panel overflow-hidden"><div className="panel-header"><div><h2 className="panel-title">Resumo por competência</h2><p className="panel-description">Conferência dos números apresentados</p></div><span className="record-badge record-normal">{report.scopeLabel}</span></div><div className="overflow-x-auto"><table className="data-table min-w-[620px]"><thead><tr><th>Competência</th><th className="text-right">Coletado</th><th className="text-right">Depositado</th><th className="text-right">Saldo</th><th className="text-right">Coletas</th></tr></thead><tbody>{report.months.map((month) => <tr key={month.competency}><td className="font-medium text-foreground">{month.label}</td><td className="text-right">{formatCurrency(month.collectedInCents)}</td><td className="text-right">{formatCurrency(month.depositedInCents)}</td><td className="text-right font-semibold text-foreground">{formatCurrency(month.balanceInCents)}</td><td className="text-right">{month.collectionsCount}</td></tr>)}</tbody></table></div></article>
      </section>

      {!hasData && !invalidPeriod && <div className="rounded-xl border border-dashed border-border p-8 text-center"><BuildingIcon className="mx-auto size-7 text-muted" /><p className="mt-3 text-sm font-medium text-foreground">Nenhum dado encontrado</p><p className="mt-1 text-xs text-muted">Altere o período ou o escopo do relatório.</p></div>}
    </div>
  );
}

function ExportButton({ label, loading, disabled, onClick }: { label: string; loading: boolean; disabled: boolean; onClick: () => void }) {
  return <button className="button-secondary disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={onClick} type="button"><DownloadIcon className="size-4" /> {loading ? "Gerando..." : label}</button>;
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof PackageIcon; label: string; value: string; detail: string; tone: "brand" | "blue" | "green" | "amber" }) {
  return <article className="metric-card"><div className={`metric-icon metric-icon-${tone}`}><Icon className="size-5" /></div><p className="mt-4 text-xs font-medium text-muted">{label}</p><p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p><p className="mt-1.5 text-xs text-muted">{detail}</p></article>;
}
