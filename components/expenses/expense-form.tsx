"use client";

import { useState, type FormEvent } from "react";
import { ReceiptIcon } from "@/components/icons";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { Expense } from "@/lib/domain/types";
import { paymentMethods } from "@/lib/domain/expense";
import { localDatabase } from "@/lib/storage/local-database";

const suggestedCategories = ["Água", "Energia elétrica", "Manutenção", "Materiais", "Limpeza", "Serviços", "Impostos e taxas", "Outros"];

type ExpenseFormProps = {
  churchId: string;
  competency: string;
  expense?: Expense;
  onSuccess: () => void;
};

export function ExpenseForm({ churchId, competency, expense, onSuccess }: ExpenseFormProps) {
  const [referenceCompetency, setReferenceCompetency] = useState(expense?.competency ?? competency);
  const [dueDate, setDueDate] = useState(expense?.dueDate ?? "");
  const [paymentDate, setPaymentDate] = useState(expense?.paymentDate ?? "");
  const [paymentMethod, setPaymentMethod] = useState<Expense["paymentMethod"]>(expense?.paymentMethod ?? "automatic_debit");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amountInCents, setAmountInCents] = useState(expense?.amountInCents ?? 0);
  const [payee, setPayee] = useState(expense?.payee ?? "");
  const [documentNumber, setDocumentNumber] = useState(expense?.documentNumber ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referenceCompetency || !dueDate || !description.trim() || !category.trim() || amountInCents <= 0) {
      setError("Informe referência, vencimento, descrição, categoria e um valor maior que zero.");
      return;
    }
    const input = {
      churchId,
      competency: referenceCompetency,
      dueDate,
      paymentDate,
      status: paymentDate ? "paid" as const : "pending" as const,
      paymentMethod,
      description: description.trim(),
      category: category.trim(),
      amountInCents,
      payee: payee.trim(),
      documentNumber: documentNumber.trim(),
      notes: notes.trim(),
    };
    try {
      if (expense) localDatabase.updateExpense(expense.id, input);
      else localDatabase.addExpense(input);
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a despesa.");
    }
  }

  return (
    <form className="p-4 sm:p-5" onSubmit={submit}>
      <div className="mb-4 rounded-xl border border-border bg-surface-subtle p-3 text-xs leading-5 text-muted">
        A referência define em qual mês a despesa aparece nos relatórios. Vencimento e pagamento podem ocorrer em meses diferentes.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Mês de referência<input className="form-control" onChange={(event) => setReferenceCompetency(event.target.value)} required type="month" value={referenceCompetency} /></label>
        <label className="field-label">Data de vencimento<input className="form-control" onChange={(event) => setDueDate(event.target.value)} required type="date" value={dueDate} /></label>
        <label className="field-label">Data do pagamento <span className="font-normal text-muted">(opcional)</span><input className="form-control" onChange={(event) => setPaymentDate(event.target.value)} type="date" value={paymentDate} /></label>
        <label className="field-label">Forma de pagamento<select className="form-control" onChange={(event) => setPaymentMethod(event.target.value as Expense["paymentMethod"])} value={paymentMethod}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
        <label className="field-label">Categoria<input className="form-control" list="expense-categories" onChange={(event) => setCategory(event.target.value)} placeholder="Selecione ou digite" required value={category} /><datalist id="expense-categories">{suggestedCategories.map((item) => <option key={item} value={item} />)}</datalist></label>
        <label className="field-label sm:col-span-2">Descrição<input className="form-control" onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Troca de lâmpadas do salão" required value={description} /></label>
        <label className="field-label">Valor<CurrencyInput onValueChange={setAmountInCents} required valueInCents={amountInCents} /></label>
        <label className="field-label">Pago a <span className="font-normal text-muted">(opcional)</span><input className="form-control" onChange={(event) => setPayee(event.target.value)} placeholder="Fornecedor ou responsável" value={payee} /></label>
        <label className="field-label">Comprovante ou documento <span className="font-normal text-muted">(opcional)</span><input className="form-control" onChange={(event) => setDocumentNumber(event.target.value)} placeholder={paymentMethod === "automatic_debit" ? "Não necessário para débito automático" : "Nota, recibo ou referência"} value={documentNumber} /></label>
        <label className="field-label">Observação <span className="font-normal text-muted">(opcional)</span><input className="form-control" onChange={(event) => setNotes(event.target.value)} placeholder="Informação adicional" value={notes} /></label>
      </div>
      {paymentMethod === "automatic_debit" && <p className="mt-3 rounded-lg border border-brand/20 bg-brand-soft px-3 py-2 text-xs leading-5 text-muted">Débito automático não exige comprovante. Informe a data do pagamento quando o débito aparecer na conta.</p>}
      {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-5 flex justify-end"><button className="button-primary" type="submit"><ReceiptIcon className="size-4" /> {expense ? "Salvar alterações" : "Registrar despesa"}</button></div>
    </form>
  );
}
