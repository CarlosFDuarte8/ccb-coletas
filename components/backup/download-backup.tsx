"use client";
import { DownloadIcon } from "@/components/icons";
import { useMutation } from "@/hooks/use-mutation";
import { useDatabaseStatus } from "@/hooks/use-database-status";
import { databaseStore } from "@/lib/storage/database-store";

export function BackupDownloadButton({ className = "button-primary", label = "Exportar dados" }: { className?: string; label?: string }) {
  const status = useDatabaseStatus();
  const { run, pending, error } = useMutation();
  function download() {
    void run(async () => {
      if (!await databaseStore.refreshFromCloud()) throw new Error("Aguarde a atualização dos dados antes de exportar.");
      const url = URL.createObjectURL(new Blob([JSON.stringify(databaseStore.getSnapshot(), null, 2)], { type: "application/json;charset=utf-8" }));
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const link = document.createElement("a");
      link.href = url;
      link.download = `ccb-coletas-backup-${date}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return <><button className={className} disabled={pending || status.loading || status.saving} onClick={download} type="button"><DownloadIcon className="size-4" /> {pending ? "Preparando arquivo…" : label}</button>{error && <p className="text-xs text-red-600" role="alert">{error}</p>}</>;
}
