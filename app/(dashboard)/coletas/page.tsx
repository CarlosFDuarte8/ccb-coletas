"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  BuildingIcon,
  CalendarIcon,
  CheckCircleIcon,
  DownloadIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  ClockIcon,
  TrashIcon,
} from "@/components/icons";
import { CollectionForm } from "@/components/collections/collection-form";
import { DepositForm } from "@/components/collections/deposit-form";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDatabase } from "@/hooks/use-database";
import { formatCurrency } from "@/lib/domain/money";
import { buildMonthlySchedule } from "@/lib/domain/schedule";
import { databaseStore } from "@/lib/storage/database-store";
import { useChurchSelection } from "@/components/churches/church-selection-provider";

type OpenModal = "collection" | "deposit-new" | `deposit:${string}` | null;

function previousCompetency(competency: string) {
  const [year, month] = competency.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCompetency(competency: string) {
  const [year, month] = competency.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatDate(date: string) {
  if (!date) return "Aguardando";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function CollectionsPage() {
  const database = useDatabase();
  const { church, churchId: selectedChurchId, setChurchId, competency, setCompetency } = useChurchSelection();
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const collections = useMemo(
    () => database.collections.filter((item) => item.churchId === selectedChurchId && item.competency === competency).sort((a, b) => b.date.localeCompare(a.date)),
    [database.collections, selectedChurchId, competency],
  );
  const deposits = useMemo(
    () => database.deposits.filter((item) => item.churchId === selectedChurchId && item.competency === competency).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [database.deposits, selectedChurchId, competency],
  );
  const activeDeposit = openModal?.startsWith("deposit:")
    ? deposits.find((item) => item.id === openModal.slice("deposit:".length))
    : undefined;
  const competencyRecord = database.competencies.find((item) => item.churchId === selectedChurchId && item.competency === competency);
  const isClosed = competencyRecord?.status === "closed";
  const scheduledOccurrences = useMemo(
    () => buildMonthlySchedule(selectedChurchId, competency, database.serviceSchedules, database.scheduleExceptions),
    [selectedChurchId, competency, database.serviceSchedules, database.scheduleExceptions],
  );
  const selectedOccurrence = scheduledOccurrences.find((item) => item.id === selectedOccurrenceId);
  const selectedCollection = collections.find((item) => item.id === selectedCollectionId);

  const collected = collections.reduce((sum, item) => sum + item.amountInCents, 0);
  const reservedMaintenanceCash = collections.reduce((sum, item) => sum + item.maintenanceCashInCents, 0);
  const paidFromMaintenanceCash = database.expenses
    .filter((item) => item.churchId === selectedChurchId && item.competency === competency && item.status === "paid" && item.paymentSource === "maintenance_cash")
    .reduce((sum, item) => sum + item.amountInCents, 0);
  const confirmedDeposits = deposits.filter((item) => item.status === "confirmed");
  const deposited = confirmedDeposits.reduce((sum, item) => sum + item.amountInCents, 0);
  const pendingDeposits = deposits.filter((item) => item.status === "draft");
  const expectedDeposits = collected - reservedMaintenanceCash;
  const outstanding = expectedDeposits - deposited;
  const previousMonth = previousCompetency(competency);
  const previousTotal = database.collections
    .filter((item) => item.churchId === selectedChurchId && item.competency === previousMonth)
    .reduce((sum, item) => sum + item.amountInCents, 0);
  const comparison = previousTotal > 0 ? ((collected - previousTotal) / previousTotal) * 100 : null;

  function exportBackup() {
    const file = new Blob([JSON.stringify(database, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ccb-coletas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function closeMonth() {
    if (pendingDeposits.length > 0) {
      window.alert("Confirme ou exclua todos os depósitos em rascunho antes de fechar a competência.");
      return;
    }
    if (paidFromMaintenanceCash > reservedMaintenanceCash) {
      window.alert("As despesas pagas pelo caixa de manutenção ultrapassam o valor reservado nesta competência.");
      return;
    }
    if (outstanding !== 0) {
      window.alert(`Ainda existe uma diferença de ${formatCurrency(outstanding)} entre depósitos confirmados e o valor esperado para depósito.`);
      return;
    }
    if (window.confirm(`Fechar a competência ${formatCompetency(competency)}? Os registros ficarão bloqueados para edição.`)) {
      databaseStore.closeCompetency(selectedChurchId, competency);
    }
  }

  function reopenMonth() {
    if (window.confirm("Reabrir esta competência para correções?")) {
      databaseStore.reopenCompetency(selectedChurchId, competency);
    }
  }

  return (
    <div className="page-container">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow">Livro mensal</p>
            <span className={`record-badge ${isClosed ? "record-closed" : "record-confirmed"}`}>{isClosed ? "Competência fechada" : "Competência aberta"}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Coletas e depósitos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Os registros exibidos pertencem somente à competência selecionada.</p>
          <button className="button-ghost mt-2 -ml-2" onClick={exportBackup} type="button"><DownloadIcon className="size-4" /> Exportar backup</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:min-w-48">
          <label className="field-label lg:hidden">
            Igreja
            <SearchableSelect
              key={selectedChurchId}
              onChange={(value) => { if (value) setChurchId(value); }}
              options={database.churches.map((item) => ({ value: item.id, label: item.name, description: `${item.code} · ${database.sectors.find((sector) => sector.id === item.sectorId)?.name ?? "Sem setor"}` }))}
              placeholder="Buscar igreja..."
              value={selectedChurchId}
            />
          </label>
          <label className="field-label">
            Competência
            <input className="form-control" onChange={(event) => setCompetency(event.target.value)} type="month" value={competency} />
          </label>
        </div>
      </section>

      {church && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-[var(--shadow)] sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><BuildingIcon className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{church.name} · {formatCompetency(competency)}</p>
              <p className="truncate text-xs text-muted">Setor {database.sectors.find((sector) => sector.id === church.sectorId)?.name} · Código {church.code}</p>
            </div>
          </div>
          {isClosed ? (
            <button className="button-secondary" onClick={reopenMonth} type="button">Reabrir competência</button>
          ) : (
            <button className="button-secondary" onClick={closeMonth} type="button"><CheckCircleIcon className="size-4" /> Fechar mês</button>
          )}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo financeiro">
        <SummaryCard icon={PackageIcon} label="Total coletado" value={formatCurrency(collected)} detail={`${collections.length} lançamento${collections.length === 1 ? "" : "s"}`} tone="brand" />
        <SummaryCard icon={BanknoteIcon} label="Total depositado" value={formatCurrency(deposited)} detail={`${confirmedDeposits.length} confirmado${confirmedDeposits.length === 1 ? "" : "s"}`} tone="blue" />
        <SummaryCard icon={ReceiptIcon} label="Caixa de manutenção" value={formatCurrency(reservedMaintenanceCash)} detail={`Usado em despesas: ${formatCurrency(paidFromMaintenanceCash)}`} tone={paidFromMaintenanceCash > reservedMaintenanceCash ? "amber" : "green"} />
        <SummaryCard icon={ReceiptIcon} label="A depositar" value={formatCurrency(outstanding)} detail={pendingDeposits.length > 0 ? `${pendingDeposits.length} depósito${pendingDeposits.length === 1 ? "" : "s"} em rascunho · esperado: ${formatCurrency(expectedDeposits)}` : `Esperado: ${formatCurrency(expectedDeposits)}`} tone={outstanding !== 0 ? "amber" : "green"} />
        <SummaryCard icon={BuildingIcon} label="Comparação mensal" value={comparison === null ? "—" : `${comparison >= 0 ? "+" : ""}${comparison.toFixed(1)}%`} detail={`Anterior: ${formatCurrency(previousTotal)}`} tone="green" />
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Coletas previstas</h2>
            <p className="panel-description">Geradas automaticamente pela programação de {church?.name}</p>
          </div>
          <span className="record-badge record-normal">{scheduledOccurrences.length} ocorrência{scheduledOccurrences.length === 1 ? "" : "s"}</span>
        </div>
        <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 2xl:grid-cols-3">
          {scheduledOccurrences.map((occurrence) => {
            const entries = collections.filter((collection) => collection.date === occurrence.date && (collection.serviceScheduleId ? collection.serviceScheduleId === occurrence.serviceScheduleId : collection.meetingType === occurrence.meetingType));
            const occurrenceTotal = entries.reduce((sum, collection) => sum + collection.amountInCents, 0);
            return (
              <article className="rounded-xl border border-border bg-surface-subtle p-3.5" key={occurrence.id}>
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand shadow-sm"><CalendarIcon className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold capitalize text-foreground">{new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${occurrence.date}T00:00:00Z`))}</p>
                      {occurrence.exceptionDescription && <span className="record-badge record-especial">Exceção</span>}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-foreground">{occurrence.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><ClockIcon className="size-3" /> {occurrence.time} · {occurrence.meetingType === "rjm" ? "RJM" : "Culto"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <div>{entries.length > 0 ? <><p className="text-xs font-semibold text-brand">{formatCurrency(occurrenceTotal)}</p><p className="text-[10px] text-muted">{occurrenceTotal === 0 ? "Confirmado sem arrecadação" : `${entries.length} registro${entries.length === 1 ? "" : "s"}`}</p></> : <span className="record-badge record-draft">Pendente</span>}</div>
                  {!isClosed && <button className={entries.length > 0 ? "button-ghost" : "button-secondary"} onClick={() => { setSelectedOccurrenceId(occurrence.id); setSelectedCollectionId(entries[0]?.id ?? null); setOpenModal("collection"); }} type="button">{entries.length > 0 ? "Editar" : "Registrar"}</button>}
                </div>
              </article>
            );
          })}
          {scheduledOccurrences.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted md:col-span-2 2xl:col-span-3">Nenhuma programação encontrada para esta igreja. Configure os dias de culto no cadastro da igreja.</div>}
        </div>
      </section>

      {!isClosed && (
        <section className="flex flex-col gap-2 sm:flex-row">
          <button className="button-primary" onClick={() => { setSelectedOccurrenceId(null); setSelectedCollectionId(null); setOpenModal("collection"); }} type="button"><PlusIcon className="size-4" /> Coleta fora da programação</button>
          <button className="button-secondary" onClick={() => setOpenModal("deposit-new")} type="button"><BanknoteIcon className="size-4" /> Gerar depósito</button>
        </section>
      )}

      <section className="grid items-start gap-4 2xl:grid-cols-2">
        <article className="panel overflow-hidden">
          <div className="panel-header">
            <div><h2 className="panel-title">Coletas da competência</h2><p className="panel-description">Culto oficial e reunião de jovens e menores</p></div>
            <strong className="text-sm text-brand">{formatCurrency(collected)}</strong>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead><tr><th>Data</th><th>Reunião</th><th>Tipo</th><th className="text-right">Valor</th><th className="text-right">Caixa manutenção</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {collections.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.meetingType === "rjm" ? "RJM" : "Culto oficial"}</td>
                    <td><span className={`record-badge record-${item.collectionType}`}>{item.collectionType === "normal" ? "Normal" : "Especial"}</span></td>
                    <td className="text-right font-semibold text-foreground">{formatCurrency(item.amountInCents)}</td>
                    <td className="text-right">{formatCurrency(item.maintenanceCashInCents)}</td>
                    <td className="w-20">{!isClosed && <div className="flex justify-end gap-1"><button aria-label="Editar coleta" className="icon-button size-8" onClick={() => { const occurrence = scheduledOccurrences.find((scheduled) => scheduled.date === item.date && scheduled.serviceScheduleId === item.serviceScheduleId); setSelectedOccurrenceId(occurrence?.id ?? null); setSelectedCollectionId(item.id); setOpenModal("collection"); }} title="Editar coleta" type="button"><ArrowUpRightIcon className="size-4" /></button><DeleteButton label="Excluir coleta" onDelete={() => databaseStore.removeCollection(item.id)} /></div>}</td>
                  </tr>
                ))}
                {collections.length === 0 && <tr><td className="empty-cell" colSpan={6}>Nenhuma coleta registrada em {formatCompetency(competency)}.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel overflow-hidden">
          <div className="panel-header">
            <div><h2 className="panel-title">Depósitos da competência</h2><p className="panel-description">Rascunhos, confirmações e comprovantes</p></div>
            <strong className="text-sm text-brand">{formatCurrency(deposited)}</strong>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[650px]">
              <thead><tr><th>Status</th><th>Data bancária</th><th>Nº comprovante</th><th className="text-right">Valor</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {deposits.map((item) => (
                  <tr key={item.id}>
                    <td><span className={`record-badge record-${item.status}`}>{item.status === "confirmed" ? "Confirmado" : "Rascunho"}</span></td>
                    <td>{formatDate(item.date)}</td>
                    <td className="font-mono text-xs">{item.transactionNumber || "—"}</td>
                    <td className="text-right font-semibold text-foreground">{formatCurrency(item.amountInCents)}</td>
                    <td className="w-20">
                      <div className="flex justify-end gap-1">
                        <button aria-label="Abrir depósito" className="icon-button size-8" onClick={() => setOpenModal(`deposit:${item.id}`)} title="Abrir depósito" type="button"><ArrowUpRightIcon className="size-4" /></button>
                        {!isClosed && <DeleteButton label="Excluir depósito" onDelete={() => databaseStore.removeDeposit(item.id)} />}
                      </div>
                    </td>
                  </tr>
                ))}
                {deposits.length === 0 && <tr><td className="empty-cell" colSpan={5}>Nenhum depósito gerado nesta competência.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <Modal description={`Competência ${formatCompetency(competency)} · ${church?.name ?? ""}`} onClose={() => { setOpenModal(null); setSelectedOccurrenceId(null); setSelectedCollectionId(null); }} open={openModal === "collection"} title={selectedCollection ? "Editar coleta" : "Registrar coleta"}>
        <CollectionForm
          churchId={selectedChurchId}
          collection={selectedCollection}
          competency={competency}
          defaultDate={selectedOccurrence?.date}
          defaultMeetingType={selectedOccurrence?.meetingType}
          key={selectedCollection?.updatedAt ?? selectedOccurrence?.id ?? "manual"}
          onSuccess={() => { setOpenModal(null); setSelectedOccurrenceId(null); setSelectedCollectionId(null); }}
          serviceScheduleId={selectedOccurrence?.serviceScheduleId}
          serviceTime={selectedOccurrence?.time}
          serviceTitle={selectedOccurrence ? `${selectedOccurrence.title} · ${selectedOccurrence.time}` : undefined}
        />
      </Modal>

      <Modal description={`O depósito ficará vinculado a ${formatCompetency(competency)}`} onClose={() => setOpenModal(null)} open={openModal === "deposit-new"} size="large" title="Gerar depósito">
        <DepositForm churchId={selectedChurchId} competency={competency} onSuccess={() => setOpenModal(null)} />
      </Modal>

      <Modal
        description={`Competência ${formatCompetency(competency)} · ${activeDeposit?.status === "confirmed" ? "Confirmado" : "Em preparação"}`}
        onClose={() => setOpenModal(null)}
        open={Boolean(activeDeposit)}
        size="large"
        title={activeDeposit?.status === "confirmed" ? "Detalhes do depósito" : "Editar e confirmar depósito"}
      >
        {activeDeposit && <DepositForm churchId={selectedChurchId} competency={competency} deposit={activeDeposit} key={activeDeposit.updatedAt} onSuccess={() => setOpenModal(null)} />}
      </Modal>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone }: { icon: typeof PackageIcon; label: string; value: string; detail: string; tone: "brand" | "blue" | "green" | "amber" }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon-${tone}`}><Icon className="size-5" /></div>
      <p className="mt-4 text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{detail}</p>
    </article>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button aria-label={label} className="icon-button size-8 text-muted hover:text-red-600" onClick={() => { if (window.confirm("Deseja realmente excluir este registro?")) onDelete(); }} title={label} type="button">
      <TrashIcon className="size-4" />
    </button>
  );
}
