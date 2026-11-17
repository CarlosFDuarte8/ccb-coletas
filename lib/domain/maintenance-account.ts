import type { AppDatabase } from "./types";

export function maintenanceMovements(database: AppDatabase, churchId: string) {
  return [
    ...database.collections.filter((item) => item.churchId === churchId && item.maintenanceCashInCents > 0)
      .map((item) => ({ date: item.date, amountInCents: item.maintenanceCashInCents })),
    ...database.expenses.filter((item) => item.churchId === churchId && item.status === "paid" && item.paymentSource === "maintenance_cash" && item.paymentDate)
      .map((item) => ({ date: item.paymentDate, amountInCents: -item.amountInCents })),
  ];
}

export function maintenanceStatement(database: AppDatabase, churchId: string, from: string, to: string) {
  let openingInCents = 0;
  let incomingInCents = 0;
  let outgoingInCents = 0;
  for (const item of maintenanceMovements(database, churchId)) {
    if (item.date < from) openingInCents += item.amountInCents;
    else if (item.date <= to) {
      if (item.amountInCents > 0) incomingInCents += item.amountInCents;
      else outgoingInCents -= item.amountInCents;
    }
  }
  return { openingInCents, incomingInCents, outgoingInCents, balanceInCents: openingInCents + incomingInCents - outgoingInCents };
}

export function assertMaintenanceLedger(database: AppDatabase) {
  for (const church of database.churches) {
    const daily = new Map<string, number>();
    for (const item of maintenanceMovements(database, church.id)) daily.set(item.date, (daily.get(item.date) ?? 0) + item.amountInCents);
    let balance = 0;
    for (const [date, amount] of [...daily].sort(([a], [b]) => a.localeCompare(b))) {
      balance += amount;
      if (balance < 0) throw new Error(`O caixa local de manutenção não possui saldo suficiente em ${date.split("-").reverse().join("/")}.`);
    }
  }
}
