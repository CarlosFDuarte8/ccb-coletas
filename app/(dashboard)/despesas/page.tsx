"use client";

import { useMemo, useState } from "react";
import { ArrowUpRightIcon, BuildingIcon, ChartIcon, PlusIcon, ReceiptIcon, TrashIcon } from "@/components/icons";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useMutation } from "@/hooks/use-mutation";
import { useDatabase } from "@/hooks/use-database";
import { formatCurrency } from "@/lib/domain/money";
import { paymentMethodLabel, paymentSourceLabel } from "@/lib/domain/expense";
import { databaseStore } from "@/lib/storage/database-store";
import { useChurchSelection } from "@/components/churches/church-selection-provider";

function formatCompetency(competency: string) {
  const [year, month] = competency.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatDate(date: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function ExpensesPage() {
  const database = useDatabase();
  const { church, churchId: selectedChurchId, setChurchId, competency, setCompetency, canWrite } = useChurchSelection();
  const { run } = useMutation();
  const [basis, setBasis] = useState<"competency" | "cash">("competency");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const expenses = useMemo(
    () => database.expenses.filter((item) => item.churchId === selectedChurchId && (basis === "cash" ? item.status === "paid" && item.paymentDate.slice(0,7) === competency : item.competency === competency)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [database.expenses, selectedChurchId, competency, basis],
  );
  const editingExpense = editingId && editingId !== "new" ? expenses.find((item) => item.id === editingId) : undefined;
  const total = expenses.reduce((sum, item) => sum + item.amountInCents, 0);
  const paid = expenses.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amountInCents, 0);
  const pending = total - paid;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = expenses.filter((item) => item.status === "pending" && item.dueDate < today);

  return (
    <div className="page-container">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2"><p className="eyebrow">Saídas</p><span className="record-badge record-confirmed">Por referência</span></div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Despesas da igreja</h1><p className="mt-2 max-w-2xl text-sm text-muted">Registre contas pela referência, mesmo quando o vencimento ou pagamento ocorrer em outro mês.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:min-w-48"><label className="field-label">Consultar por<select className="form-control" onChange={(event) => setBasis(event.target.value as "competency" | "cash")} value={basis}><option value="competency">Competência da conta</option><option value="cash">Mês do pagamento</option></select></label>
          <label className="field-label lg:hidden">Igreja<SearchableSelect key={selectedChurchId} onChange={(value) => { if (value) setChurchId(value); }} options={database.churches.map((item) => ({ value: item.id, label: item.name, description: `${item.code} · ${database.sectors.find((sector) => sector.id === item.sectorId)?.name}` }))} placeholder="Buscar igreja..." value={selectedChurchId} /></label>
          <label className="field-label">Competência<input className="form-control" onChange={(event) => setCompetency(event.target.value)} type="month" value={competency} /></label>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-[var(--shadow)] sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><BuildingIcon className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{church?.name} · {formatCompetency(competency)}</p><p className="truncate text-xs text-muted">Código {church?.code}</p></div></div>
        <button className="button-primary" disabled={!canWrite} onClick={() => setEditingId("new")} type="button"><PlusIcon className="size-4" /> Registrar despesa</button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total de despesas" value={formatCurrency(total)} detail={`${expenses.length} lançamento${expenses.length === 1 ? "" : "s"}`} tone="amber" icon={ReceiptIcon} />
        <Metric label="Total pago" value={formatCurrency(paid)} detail={`${expenses.filter((item) => item.status === "paid").length} conta(s) paga(s)`} tone="green" icon={ChartIcon} />
        <Metric label="A pagar" value={formatCurrency(pending)} detail={`${expenses.filter((item) => item.status === "pending").length} conta(s) pendente(s)`} tone="blue" icon={ArrowUpRightIcon} />
        <Metric label="Contas vencidas" value={String(overdue.length)} detail={formatCurrency(overdue.reduce((sum, item) => sum + item.amountInCents, 0))} tone={overdue.length ? "amber" : "green"} icon={BuildingIcon} />
      </section>

      <article className="panel overflow-hidden">
        <div className="panel-header"><div><h2 className="panel-title">Lançamentos da competência</h2><p className="panel-description">Despesas de {church?.name} em {formatCompetency(competency)}</p></div><strong className="text-sm text-amber-700 dark:text-amber-400">{formatCurrency(total)}</strong></div>
        <div className="overflow-x-auto"><table className="data-table min-w-[1180px]"><thead><tr><th>Referência</th><th>Vencimento</th><th>Pagamento</th><th>Status</th><th>Origem</th><th>Forma</th><th>Categoria</th><th>Descrição</th><th>Pago a</th><th>Documento</th><th className="text-right">Valor</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {expenses.map((expense) => <tr key={expense.id}><td>{expense.competency.split("-").reverse().join("/")}</td><td>{formatDate(expense.dueDate)}</td><td>{formatDate(expense.paymentDate)}</td><td><span className={`record-badge ${expense.status === "paid" ? "record-confirmed" : expense.dueDate < today ? "record-especial" : "record-draft"}`}>{expense.status === "paid" ? "Paga" : expense.dueDate < today ? "Vencida" : "Pendente"}</span></td><td>{paymentSourceLabel(expense.paymentSource)}</td><td>{paymentMethodLabel(expense.paymentMethod)}</td><td>{expense.category}</td><td className="max-w-56 truncate font-medium text-foreground" title={expense.description}>{expense.description}</td><td>{expense.payee || "—"}</td><td className="font-mono text-xs">{expense.documentNumber || "—"}</td><td className="text-right font-semibold text-foreground">{formatCurrency(expense.amountInCents)}</td><td className="w-20"><div className="flex justify-end gap-1"><button aria-label="Editar despesa" disabled={!canWrite} className="icon-button size-8" onClick={() => setEditingId(expense.id)} title="Editar" type="button"><ArrowUpRightIcon className="size-4" /></button><button aria-label="Excluir despesa" disabled={!canWrite} className="icon-button size-8 hover:text-red-600" onClick={() => { if (window.confirm("Excluir esta despesa?")) void run(() => databaseStore.removeExpense(expense.id)); }} title="Excluir" type="button"><TrashIcon className="size-4" /></button></div></td></tr>)}
          {expenses.length === 0 && <tr><td className="empty-cell" colSpan={12}>Nenhuma despesa registrada nesta referência.</td></tr>}
        </tbody></table></div>
      </article>

      <Modal description={`${church?.name} · Competência ${formatCompetency(competency)}`} onClose={() => setEditingId(null)} open={editingId !== null} size="large" title={editingExpense ? "Editar despesa" : "Registrar despesa"}>
        {editingId && <ExpenseForm churchId={selectedChurchId} competency={competency} expense={editingExpense} key={editingExpense?.updatedAt ?? "new"} onSuccess={() => setEditingId(null)} />}
      </Modal>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof ReceiptIcon; label: string; value: string; detail: string; tone: "brand" | "blue" | "green" | "amber" }) {
  return <article className="metric-card"><div className={`metric-icon metric-icon-${tone}`}><Icon className="size-5" /></div><p className="mt-4 text-xs font-medium text-muted">{label}</p><p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p><p className="mt-1.5 text-xs text-muted">{detail}</p></article>;
}
