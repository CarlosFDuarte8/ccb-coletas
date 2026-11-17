"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BanknoteIcon, CheckCircleIcon } from "@/components/icons";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { Deposit } from "@/lib/domain/types";
import { BRL_DENOMINATIONS_IN_CENTS, denominationLabel, formatCurrency } from "@/lib/domain/money";
import { databaseStore } from "@/lib/storage/database-store";

type DepositFormProps = {
  churchId: string;
  competency: string;
  deposit?: Deposit;
  onSuccess: () => void;
};

export function DepositForm({ churchId, competency, deposit, onSuccess }: DepositFormProps) {
  const readOnly = deposit?.status === "confirmed";
  const depositHasCounts = Object.values(deposit?.denominationCounts ?? {}).some((quantity) => quantity > 0);
  const [mode, setMode] = useState<"count" | "manual">(deposit && !depositHasCounts ? "manual" : "count");
  const [date, setDate] = useState(deposit?.date ?? "");
  const [transactionNumber, setTransactionNumber] = useState(deposit?.transactionNumber ?? "");
  const [counts, setCounts] = useState<Record<string, number>>(deposit?.denominationCounts ?? {});
  const [manualAmountInCents, setManualAmountInCents] = useState(deposit && !depositHasCounts ? deposit.amountInCents : 0);
  const [error, setError] = useState("");

  const total = useMemo(
    () => mode === "manual"
      ? manualAmountInCents
      : BRL_DENOMINATIONS_IN_CENTS.reduce((sum, value) => sum + value * (counts[String(value)] ?? 0), 0),
    [counts, manualAmountInCents, mode],
  );

  function values() {
    return {
      date,
      transactionNumber: transactionNumber.trim(),
      amountInCents: total,
      denominationCounts: mode === "count" ? counts : {},
      notes: deposit?.notes ?? "",
    };
  }

  function saveDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (total <= 0) {
      setError(mode === "count" ? "Informe ao menos uma quantidade para gerar o depósito." : "Informe o valor total do depósito.");
      return;
    }
    const shouldConfirm = Boolean(transactionNumber.trim());
    if (shouldConfirm && !date) {
      setError("Informe a data bancária para confirmar o depósito.");
      return;
    }
    try {
      if (deposit) {
        if (shouldConfirm) databaseStore.confirmDeposit(deposit.id, values());
        else databaseStore.updateDeposit(deposit.id, values());
      } else {
        databaseStore.createDeposit(churchId, competency, values(), shouldConfirm);
      }
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível salvar o depósito.");
    }
  }

  return (
    <form onSubmit={saveDeposit}>
      <div className="border-b border-border p-4 sm:p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Forma de lançamento</p>
        <div className="grid grid-cols-2 rounded-xl bg-surface-subtle p-1">
          <button className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${mode === "count" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`} disabled={readOnly} onClick={() => setMode("count")} type="button">Contar cédulas</button>
          <button className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${mode === "manual" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`} disabled={readOnly} onClick={() => setMode("manual")} type="button">Informar valor total</button>
        </div>
      </div>
      {mode === "count" ? <div className="grid grid-cols-2 gap-x-3 gap-y-2 bg-surface-subtle p-3 sm:grid-cols-3 sm:p-5">
        {BRL_DENOMINATIONS_IN_CENTS.map((denomination) => (
          <label className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs font-medium text-foreground" key={denomination}>
            <span className="min-w-15">{denominationLabel(denomination)}</span>
            <input
              aria-label={`Quantidade de ${denominationLabel(denomination)}`}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-brand"
              min="0"
              disabled={readOnly}
              onChange={(event) => setCounts((current) => ({ ...current, [String(denomination)]: Math.max(0, Number(event.target.value) || 0) }))}
              type="number"
              value={counts[String(denomination)] ?? ""}
            />
          </label>
        ))}
      </div> : <div className="bg-surface-subtle p-4 sm:p-5">
        <label className="field-label">
          Valor total do depósito
          <CurrencyInput disabled={readOnly} onValueChange={setManualAmountInCents} valueInCents={manualAmountInCents} />
        </label>
        <p className="mt-2 text-xs leading-5 text-muted">Use este modo quando não precisar registrar a quantidade individual de moedas e cédulas.</p>
      </div>}
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-soft p-3 text-brand">
          <span className="text-xs font-semibold uppercase tracking-wider">Total contado</span>
          <strong className="text-lg">{formatCurrency(total)}</strong>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Data bancária <span className="font-normal text-muted">(pode ser no mês seguinte)</span>
            <input className="form-control disabled:cursor-not-allowed disabled:opacity-65" disabled={readOnly} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <label className="field-label">
            Nº do comprovante
            <input className="form-control disabled:cursor-not-allowed disabled:opacity-65" disabled={readOnly} onChange={(event) => setTransactionNumber(event.target.value)} placeholder="Deixe vazio para salvar rascunho" value={transactionNumber} />
          </label>
        </div>
        <p className="mt-3 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs leading-5 text-muted">
          Este depósito continuará na competência <strong className="text-foreground">{competency.split("-").reverse().join("/")}</strong>, mesmo que a data bancária seja posterior.
        </p>
        {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {deposit?.status !== "confirmed" && <button className={transactionNumber.trim() ? "button-primary" : "button-secondary"} type="submit">{transactionNumber.trim() ? <CheckCircleIcon className="size-4" /> : <BanknoteIcon className="size-4" />} {transactionNumber.trim() ? "Salvar e confirmar" : "Salvar rascunho"}</button>}
        </div>
      </div>
    </form>
  );
}
