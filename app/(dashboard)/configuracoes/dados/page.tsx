"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { CheckCircleIcon, DownloadIcon, PackageIcon, PlusIcon } from "@/components/icons";
import { useDatabase } from "@/hooks/use-database";
import type { AppDatabase } from "@/lib/domain/types";
import { isDatabaseFile, type ImportSummary } from "@/lib/storage/database-import";
import { localDatabase } from "@/lib/storage/local-database";

function downloadJson(database: AppDatabase) {
  const content = new Blob([JSON.stringify(database, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ccb-coletas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SettingsPage() {
  const database = useDatabase();
  const [importData, setImportData] = useState<Partial<AppDatabase> | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [applyingInitial, setApplyingInitial] = useState(false);
  const orphanExpenses = database.expenses.filter((expense) => !database.churches.some((church) => church.id === expense.churchId));

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setSummary(null);
    setImportData(null);
    setFileName("");
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isDatabaseFile(parsed)) throw new Error("Formato de backup inválido.");
      setImportData(parsed);
      setFileName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ler o arquivo.");
      event.target.value = "";
    }
  }

  function importFile(mode: "merge" | "replace") {
    if (!importData) return;
    if (mode === "replace" && !window.confirm("Substituir todos os dados atuais? Esta ação apaga o banco local antes da importação.")) return;
    try {
      const result = localDatabase.importDatabase(importData, mode);
      setSummary(result);
      setError("");
    } catch {
      setError("O arquivo possui dados incompatíveis e não pôde ser importado.");
    }
  }

  async function applyInitialData() {
    setApplyingInitial(true);
    setError("");
    try {
      const response = await fetch("/dados-iniciais-2026");
      const parsed: unknown = await response.json();
      if (!response.ok || !isDatabaseFile(parsed)) throw new Error();
      setSummary(localDatabase.importDatabase(parsed, "merge"));
    } catch {
      setError("Não foi possível carregar os dados iniciais.");
    } finally {
      setApplyingInitial(false);
    }
  }

  return (
    <div className="page-container">
      <section><Link className="text-xs font-semibold text-brand hover:underline" href="/configuracoes">← Voltar para configurações</Link><p className="eyebrow mt-4">Administração</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Dados e backup</h1><p className="mt-2 max-w-2xl text-sm text-muted">Faça backups e mova os dados entre navegadores sem perder cadastros existentes.</p></section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="panel p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><DownloadIcon className="size-5" /></div>
          <h2 className="mt-4 panel-title">Exportar backup completo</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Gera um JSON com setores, igrejas, programação, coletas, depósitos e despesas deste navegador.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap"><button className="button-primary" onClick={() => downloadJson(database)} type="button"><DownloadIcon className="size-4" /> Exportar meus dados</button><a className="button-secondary" download href="/dados-iniciais-2026">Baixar JSON inicial</a><button className="button-secondary" disabled={applyingInitial} onClick={applyInitialData} type="button"><PlusIcon className="size-4" /> {applyingInitial ? "Aplicando..." : "Aplicar dados iniciais agora"}</button></div>
        </article>

        <article className="panel p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-surface-subtle text-muted"><PackageIcon className="size-5" /></div>
          <h2 className="mt-4 panel-title">Importar arquivo JSON</h2>
          <p className="mt-2 text-sm leading-6 text-muted">A mesclagem reconhece igrejas pelo nome normalizado ou código, remapeia IDs e ignora registros equivalentes.</p>
          <label className="mt-5 block rounded-xl border border-dashed border-border bg-surface-subtle p-4 text-center transition-colors hover:border-brand">
            <span className="text-sm font-medium text-foreground">{fileName || "Selecionar arquivo de backup"}</span>
            <span className="mt-1 block text-xs text-muted">Somente arquivos JSON gerados pelo sistema</span>
            <input accept="application/json,.json" className="sr-only" onChange={selectFile} type="file" />
          </label>
          {importData && <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-subtle p-3 text-center text-xs"><div><strong className="block text-foreground">{importData.churches?.length ?? 0}</strong><span className="text-muted">igrejas</span></div><div><strong className="block text-foreground">{importData.collections?.length ?? 0}</strong><span className="text-muted">coletas</span></div><div><strong className="block text-foreground">{importData.expenses?.length ?? 0}</strong><span className="text-muted">despesas</span></div></div>}
          {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button className="button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!importData} onClick={() => importFile("merge")} type="button"><PlusIcon className="size-4" /> Mesclar sem duplicar</button><button className="button-secondary disabled:cursor-not-allowed disabled:opacity-50" disabled={!importData} onClick={() => importFile("replace")} type="button">Substituir tudo</button></div>
        </article>
      </section>

      {orphanExpenses.length > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{orphanExpenses.length} despesas sem igreja vinculada</h2><p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">Clique em “Aplicar dados iniciais agora” para criar ou identificar as igrejas e reparar os vínculos, sem duplicar lançamentos.</p></section>}

      {summary && <section className="rounded-xl border border-brand/20 bg-brand-soft p-4"><div className="flex items-start gap-3"><CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-brand" /><div><h2 className="text-sm font-semibold text-foreground">Importação concluída</h2><p className="mt-1 text-xs leading-5 text-muted">Adicionados: {summary.sectors} setores, {summary.churches} igrejas, {summary.collections} coletas, {summary.deposits} depósitos, {summary.expenses} despesas e {summary.schedules} horários. {summary.repaired} vínculos foram reparados e {summary.skipped} registros equivalentes foram preservados sem duplicação.</p></div></div></section>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Setores" value={database.sectors.length} />
        <Info label="Igrejas" value={database.churches.length} />
        <Info label="Coletas" value={database.collections.length} />
        <Info label="Despesas" value={database.expenses.length} />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return <article className="panel p-4"><p className="text-xs text-muted">{label} no banco local</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p></article>;
}
