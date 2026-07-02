"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { Collection } from "@/lib/domain/types";
import { localDatabase } from "@/lib/storage/local-database";

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
  const [notes, setNotes] = useState(collection?.notes ?? "");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError("Informe a data da coleta.");
      return;
    }
    if (amountInCents === 0 && !window.confirm("Confirmar que não houve nenhum valor nesta coleta? O registro será salvo como R$ 0,00.")) return;

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
    };
    if (collection) localDatabase.updateCollection(collection.id, input);
    else localDatabase.addCollection(input);
    setAmountInCents(0);
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
