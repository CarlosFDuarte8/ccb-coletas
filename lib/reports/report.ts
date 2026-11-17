import type { AppDatabase, Collection, Deposit, Expense } from "@/lib/domain/types";

export type ReportScope = "general" | "sector" | "church";
export type ReportContent = "complete" | "collections" | "expenses";

export type ReportFilters = {
  scope: ReportScope;
  scopeId: string;
  from: string;
  to: string;
  content: ReportContent;
};

export type ReportMonth = {
  competency: string;
  label: string;
  collectedInCents: number;
  reservedMaintenanceCashInCents: number;
  depositedInCents: number;
  balanceInCents: number;
  normalInCents: number;
  specialInCents: number;
  cultoInCents: number;
  rjmInCents: number;
  collectionsCount: number;
  zeroCollectionsCount: number;
  expensesInCents: number;
  netResultInCents: number;
  paidExpensesInCents: number;
  pendingExpensesInCents: number;
  expensesCount: number;
};

export type ReportChurch = {
  churchId: string;
  churchName: string;
  churchCode: string;
  sectorName: string;
  collectedInCents: number;
  depositedInCents: number;
  balanceInCents: number;
  expensesInCents: number;
  netResultInCents: number;
};

export type CollectionReportRow = Collection & {
  churchName: string;
  churchCode: string;
  sectorName: string;
};

export type DepositReportRow = Deposit & {
  churchName: string;
  churchCode: string;
  sectorName: string;
};

export type ExpenseReportRow = Expense & {
  churchName: string;
  churchCode: string;
  sectorName: string;
};

export type ReportData = {
  filters: ReportFilters;
  scopeLabel: string;
  months: ReportMonth[];
  churches: ReportChurch[];
  collections: CollectionReportRow[];
  deposits: DepositReportRow[];
  expenses: ExpenseReportRow[];
  totals: {
    collectedInCents: number;
    reservedMaintenanceCashInCents: number;
    depositedInCents: number;
    balanceInCents: number;
    normalInCents: number;
    specialInCents: number;
    cultoInCents: number;
    rjmInCents: number;
    collectionsCount: number;
    zeroCollectionsCount: number;
    averagePerMonthInCents: number;
    expensesInCents: number;
    netResultInCents: number;
    paidExpensesInCents: number;
    pendingExpensesInCents: number;
    paidExpensesCount: number;
    pendingExpensesCount: number;
  };
};

function monthRange(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if (!fromYear || !fromMonth || !toYear || !toMonth) return [];
  const start = fromYear * 12 + fromMonth - 1;
  const end = toYear * 12 + toMonth - 1;
  if (start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const absolute = start + index;
    const year = Math.floor(absolute / 12);
    const month = absolute % 12 + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

function monthLabel(competency: string) {
  const [year, month] = competency.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
    .format(new Date(year, month - 1, 1))
    .replace(" de ", "/");
}

export function buildReport(database: AppDatabase, filters: ReportFilters): ReportData {
  const includeCollections = filters.content !== "expenses";
  const includeExpenses = filters.content !== "collections";
  const selectedChurchIds = database.churches
    .filter((church) => {
      if (filters.scope === "church") return church.id === filters.scopeId;
      if (filters.scope === "sector") return church.sectorId === filters.scopeId;
      return true;
    })
    .map((church) => church.id);
  const selectedIds = new Set(selectedChurchIds);
  const competencies = monthRange(filters.from, filters.to);
  const competencySet = new Set(competencies);
  const churchDetails = new Map(database.churches.map((church) => {
    const sectorName = database.sectors.find((sector) => sector.id === church.sectorId)?.name ?? "Sem setor";
    return [church.id, { churchName: church.name, churchCode: church.code, sectorName }];
  }));

  const collections = database.collections
    .filter((collection) => includeCollections && selectedIds.has(collection.churchId) && competencySet.has(collection.competency))
    .map((collection) => ({ ...collection, ...churchDetails.get(collection.churchId)! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const deposits = database.deposits
    .filter((deposit) => includeCollections && deposit.status === "confirmed" && selectedIds.has(deposit.churchId) && competencySet.has(deposit.competency))
    .map((deposit) => ({ ...deposit, ...churchDetails.get(deposit.churchId)! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const expenses = database.expenses
    .filter((expense) => includeExpenses && selectedIds.has(expense.churchId) && competencySet.has(expense.competency))
    .map((expense) => ({ ...expense, ...churchDetails.get(expense.churchId)! }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const months = competencies.map((competency): ReportMonth => {
    const monthCollections = collections.filter((collection) => collection.competency === competency);
    const monthDeposits = deposits.filter((deposit) => deposit.competency === competency);
    const collectedInCents = monthCollections.reduce((sum, item) => sum + item.amountInCents, 0);
    const reservedMaintenanceCashInCents = monthCollections.reduce((sum, item) => sum + item.maintenanceCashInCents, 0);
    const depositedInCents = monthDeposits.reduce((sum, item) => sum + item.amountInCents, 0);
    const expensesInCents = expenses.filter((expense) => expense.competency === competency).reduce((sum, item) => sum + item.amountInCents, 0);
    const monthExpenses = expenses.filter((expense) => expense.competency === competency);
    return {
      competency,
      label: monthLabel(competency),
      collectedInCents,
      reservedMaintenanceCashInCents,
      depositedInCents,
      balanceInCents: (collectedInCents - reservedMaintenanceCashInCents) - depositedInCents,
      normalInCents: monthCollections.filter((item) => item.collectionType === "normal").reduce((sum, item) => sum + item.amountInCents, 0),
      specialInCents: monthCollections.filter((item) => item.collectionType === "especial").reduce((sum, item) => sum + item.amountInCents, 0),
      cultoInCents: monthCollections.filter((item) => item.meetingType === "culto").reduce((sum, item) => sum + item.amountInCents, 0),
      rjmInCents: monthCollections.filter((item) => item.meetingType === "rjm").reduce((sum, item) => sum + item.amountInCents, 0),
      collectionsCount: monthCollections.length,
      zeroCollectionsCount: monthCollections.filter((item) => item.amountInCents === 0).length,
      expensesInCents,
      netResultInCents: collectedInCents - expensesInCents,
      paidExpensesInCents: monthExpenses.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amountInCents, 0),
      pendingExpensesInCents: monthExpenses.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amountInCents, 0),
      expensesCount: monthExpenses.length,
    };
  });

  const churches = database.churches
    .filter((church) => selectedIds.has(church.id))
    .map((church): ReportChurch => {
      const collectedInCents = collections.filter((item) => item.churchId === church.id).reduce((sum, item) => sum + item.amountInCents, 0);
      const reservedMaintenanceCashInCents = collections.filter((item) => item.churchId === church.id).reduce((sum, item) => sum + item.maintenanceCashInCents, 0);
      const depositedInCents = deposits.filter((item) => item.churchId === church.id).reduce((sum, item) => sum + item.amountInCents, 0);
      const expensesInCents = expenses.filter((item) => item.churchId === church.id).reduce((sum, item) => sum + item.amountInCents, 0);
      return {
        churchId: church.id,
        churchName: church.name,
        churchCode: church.code,
        sectorName: churchDetails.get(church.id)?.sectorName ?? "Sem setor",
        collectedInCents,
        depositedInCents,
        balanceInCents: (collectedInCents - reservedMaintenanceCashInCents) - depositedInCents,
        expensesInCents,
        netResultInCents: collectedInCents - expensesInCents,
      };
    })
    .sort((a, b) => filters.content === "expenses" ? b.expensesInCents - a.expensesInCents : b.collectedInCents - a.collectedInCents);

  const collectedInCents = months.reduce((sum, item) => sum + item.collectedInCents, 0);
  const reservedMaintenanceCashInCents = months.reduce((sum, item) => sum + item.reservedMaintenanceCashInCents, 0);
  const depositedInCents = months.reduce((sum, item) => sum + item.depositedInCents, 0);
  const expensesInCents = months.reduce((sum, item) => sum + item.expensesInCents, 0);
  const sector = database.sectors.find((item) => item.id === filters.scopeId);
  const church = database.churches.find((item) => item.id === filters.scopeId);
  const scopeLabel = filters.scope === "sector" ? `Setor ${sector?.name ?? "não selecionado"}` : filters.scope === "church" ? `${church?.name ?? "Igreja não selecionada"} · ${church?.code ?? ""}` : "Todas as igrejas";

  return {
    filters,
    scopeLabel,
    months,
    churches,
    collections,
    deposits,
    expenses,
    totals: {
      collectedInCents,
      reservedMaintenanceCashInCents,
      depositedInCents,
      balanceInCents: (collectedInCents - reservedMaintenanceCashInCents) - depositedInCents,
      normalInCents: months.reduce((sum, item) => sum + item.normalInCents, 0),
      specialInCents: months.reduce((sum, item) => sum + item.specialInCents, 0),
      cultoInCents: months.reduce((sum, item) => sum + item.cultoInCents, 0),
      rjmInCents: months.reduce((sum, item) => sum + item.rjmInCents, 0),
      collectionsCount: collections.length,
      zeroCollectionsCount: collections.filter((item) => item.amountInCents === 0).length,
      averagePerMonthInCents: months.length ? Math.round(collectedInCents / months.length) : 0,
      expensesInCents,
      netResultInCents: collectedInCents - expensesInCents,
      paidExpensesInCents: expenses.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amountInCents, 0),
      pendingExpensesInCents: expenses.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amountInCents, 0),
      paidExpensesCount: expenses.filter((item) => item.status === "paid").length,
      pendingExpensesCount: expenses.filter((item) => item.status === "pending").length,
    },
  };
}
