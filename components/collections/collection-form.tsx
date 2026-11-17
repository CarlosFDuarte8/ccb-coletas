"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { Collection } from "@/lib/domain/types";
import { databaseStore } from "@/lib/storage/database-store";

function defaultBreakdown(amountInCents: number) {
  return {
    pietyInCents: 0,
    maintenanceInCents: 0,
    constructionInCents: 0,
    missionsInCents: 0,
    othersInCents: amountInCents,
  };
}

type CollectionFormProps = {
  churchId: string;
  competency: string;
  onSuccess?: () => void;
  defaultDate?: string;
  defaultMeetingType?: "culto" | "rjm";
  serviceScheduleId?: string;
  serviceTime?: string;
  serviceTitle?: string;
  collection?: Collection;
};

export function CollectionForm({ churchId, competency, onSuccess, defaultDate, defaultMeetingType, serviceScheduleId, serviceTime, serviceTitle, collection }: CollectionFormProps) {
  const isScheduled = Boolean(collection?.serviceScheduleId ?? serviceScheduleId);
  const [date, setDate] = useState(collection?.date ?? defaultDate ?? "");
  const [meetingType, setMeetingType] = useState<"culto" | "rjm">(collection?.meetingType ?? defaultMeetingType ?? "culto");
  const [collectionType, setCollectionType] = useState<"normal" | "especial">(collection?.collectionType ?? "normal");
  const [amountInCents, setAmountInCents] = useState(collection?.amountInCents ?? 0);
  const initialBreakdown = collection?.breakdown ?? defaultBreakdown(collection?.amountInCents ?? 0);
  const [pietyInCents, setPietyInCents] = useState(initialBreakdown.pietyInCents);
  const [maintenanceInCents, setMaintenanceInCents] = useState(initialBreakdown.maintenanceInCents);
  const [constructionInCents, setConstructionInCents] = useState(initialBreakdown.constructionInCents);
  const [missionsInCents, setMissionsInCents] = useState(initialBreakdown.missionsInCents);
  const [othersInCents, setOthersInCents] = useState(initialBreakdown.othersInCents);
  const [maintenanceCashInCents, setMaintenanceCashInCents] = useState(collection?.maintenanceCashInCents ?? 0);
  const [notes, setNotes] = useState(collection?.notes ?? "");
  const [error, setError] = useState("");
  const breakdownTotal = pietyInCents + maintenanceInCents + constructionInCents + missionsInCents + othersInCents;
  const breakdownGap = amountInCents - breakdownTotal;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError("Informe a data da coleta.");
      return;
    }
    if (amountInCents === 0 && !window.confirm("Confirmar que não houve nenhum valor nesta coleta? O registro será salvo como R$ 0,00.")) return;

    if (breakdownTotal !== amountInCents) {
      setError("A soma do rateio deve ser igual ao valor total da coleta.");
      return;
    }
    if (maintenanceCashInCents > amountInCents) {
      setError("O caixa de manutenção não pode ser maior que o valor total da coleta.");
      return;
    }
    if (maintenanceCashInCents > maintenanceInCents) {
      setError("O caixa de manutenção deve ser menor ou igual ao valor informado em manutenção.");
      return;
    }

    const input = {
      churchId,
      competency,
      date,
      meetingType,
      collectionType,
      amountInCents,
      notes: notes.trim(),
      serviceScheduleId: collection?.serviceScheduleId ?? serviceScheduleId,
      serviceTime: collection?.serviceTime ?? serviceTime,
      breakdown: {
        pietyInCents,
        maintenanceInCents,
        constructionInCents,
        missionsInCents,
        othersInCents,
      },
      maintenanceCashInCents,
    };
    if (collection) databaseStore.updateCollection(collection.id, input);
    else databaseStore.addCollection(input);
    setAmountInCents(0);
    const initial = defaultBreakdown(0);
    setPietyInCents(initial.pietyInCents);
    setMaintenanceInCents(initial.maintenanceInCents);
    setConstructionInCents(initial.constructionInCents);
    setMissionsInCents(initial.missionsInCents);
    setOthersInCents(initial.othersInCents);
    setMaintenanceCashInCents(0);
    setNotes("");
    setError("");
    onSuccess?.();
  }

  return (
    <form className="p-4 sm:p-5" onSubmit={handleSubmit}>
      {isScheduled && (
        <div className="mb-4 rounded-xl border border-border bg-brand-soft px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground">{serviceTitle}</p>
          <p className="mt-0.5 text-xs text-muted">Data e reunião preenchidas pela programação da igreja.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Data da coleta
          <input className="form-control disabled:cursor-not-allowed disabled:opacity-70" disabled={isScheduled} max={`${competency}-31`} min={`${competency}-01`} onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
        </label>
        <label className="field-label">
          Reunião
          <select className="form-control disabled:cursor-not-allowed disabled:opacity-70" disabled={isScheduled} onChange={(event) => setMeetingType(event.target.value as "culto" | "rjm")} value={meetingType}>
            <option value="culto">Culto oficial</option>
            <option value="rjm">RJM</option>
          </select>
        </label>
        <label className="field-label">
          Tipo de coleta
          <select className="form-control" onChange={(event) => setCollectionType(event.target.value as "normal" | "especial")} value={collectionType}>
            <option value="normal">Normal</option>
            <option value="especial">Especial</option>
          </select>
        </label>
        <label className="field-label">
          Valor
          <CurrencyInput onValueChange={setAmountInCents} required valueInCents={amountInCents} />
        </label>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-surface-subtle p-3.5 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Rateio da coleta</p>
        <p className="mt-1 text-xs text-muted">Distribua o valor total entre os destinos abaixo.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="field-label">Piedade<CurrencyInput onValueChange={setPietyInCents} valueInCents={pietyInCents} /></label>
          <label className="field-label">Manutenção<CurrencyInput onValueChange={setMaintenanceInCents} valueInCents={maintenanceInCents} /></label>
          <label className="field-label">Construção<CurrencyInput onValueChange={setConstructionInCents} valueInCents={constructionInCents} /></label>
          <label className="field-label">Missões<CurrencyInput onValueChange={setMissionsInCents} valueInCents={missionsInCents} /></label>
          <label className="field-label sm:col-span-2">Outros destinos<CurrencyInput onValueChange={setOthersInCents} valueInCents={othersInCents} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Rateio atual: <strong className="text-foreground">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(breakdownTotal / 100)}</strong></span>
          <span>Diferença: <strong className={breakdownGap === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(breakdownGap / 100)}</strong></span>
          <button className="button-ghost px-2.5 py-1 text-[11px]" onClick={() => setOthersInCents((current) => Math.max(0, current + breakdownGap))} type="button">Completar em &quot;Outros&quot;</button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-brand-soft p-3.5 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Conta de caixa de manutenção</p>
        <p className="mt-1 text-xs text-muted">Este valor fica em espécie, não entra no depósito bancário e pode abater despesas pagas pelo caixa.</p>
        <label className="field-label mt-3">Valor para caixa de manutenção<CurrencyInput onValueChange={setMaintenanceCashInCents} valueInCents={maintenanceCashInCents} /></label>
      </div>
      <label className="field-label mt-4">
        Observação <span className="font-normal text-muted">(opcional)</span>
        <input className="form-control" onChange={(event) => setNotes(event.target.value)} placeholder="Informação adicional" value={notes} />
      </label>
      {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button className="button-primary mt-5 w-full sm:w-auto" type="submit">
        <PlusIcon className="size-4" /> {collection ? "Salvar alterações" : "Registrar coleta"}
      </button>
    </form>
  );
}
