"use client";
import { useDatabaseStatus } from "@/hooks/use-database-status";
import { databaseStore } from "@/lib/storage/database-store";

export function DatabaseFeedback() {
  const { error, loading, saving } = useDatabaseStatus();
  if (error) return <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert"><p>{error}</p><button className="button-secondary mt-2" disabled={loading || saving} onClick={() => { void databaseStore.refreshFromCloud().catch(() => undefined); }} type="button">{loading ? "Atualizando…" : "Atualizar dados"}</button></div>;
  if (saving || loading) return <p aria-live="polite" className="px-5 pt-3 text-xs text-muted">{saving ? "Salvando alterações…" : "Carregando dados…"}</p>;
  return null;
}
