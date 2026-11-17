import type { AppDatabase } from "@/lib/domain/types";

export type ImportSummary = {
  sectors: number;
  churches: number;
  collections: number;
  deposits: number;
  expenses: number;
  schedules: number;
  skipped: number;
  repaired: number;
};

export function isDatabaseFile(value: unknown): value is Partial<AppDatabase> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const fields: Record<string, string[]> = {
    sectors: ["id", "name"], churches: ["id", "sectorId", "name", "code"],
    collections: ["id", "churchId", "competency", "date"], deposits: ["id", "churchId", "competency"],
    expenses: ["id", "churchId", "competency", "description", "category"],
    competencies: ["id", "churchId", "competency"], serviceSchedules: ["id", "churchId", "time", "title"],
    scheduleExceptions: ["id", "churchId", "date"],
  };
  const required = ["sectors", "churches", "collections", "deposits", "expenses"];
  for (const [key, strings] of Object.entries(fields)) {
    const rows = candidate[key];
    if (rows === undefined && !required.includes(key)) continue;
    if (!Array.isArray(rows)) return false;
    const ids = new Set<string>();
    for (const entry of rows) {
      if (!entry || typeof entry !== "object") return false;
      const row = entry as Record<string, unknown>;
      if (strings.some((name) => typeof row[name] !== "string" || !(row[name] as string).trim())) return false;
      if (ids.has(row.id as string)) return false;
      ids.add(row.id as string);
      if ("competency" in row && (typeof row.competency !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.competency))) return false;
      if (["collections", "deposits", "expenses"].includes(key) && !validCents(row.amountInCents)) return false;
      if (key === "collections") {
        if (row.maintenanceCashInCents !== undefined && !validCents(row.maintenanceCashInCents)) return false;
        if (row.breakdown !== undefined) {
          if (!row.breakdown || typeof row.breakdown !== "object") return false;
          const breakdown = row.breakdown as Record<string, unknown>;
          const parts = ["pietyInCents", "maintenanceInCents", "constructionInCents", "missionsInCents", "othersInCents"].map((name) => breakdown[name]);
          if (!parts.every(validCents) || (parts as number[]).reduce((sum, item) => sum + item, 0) !== row.amountInCents) return false;
          if (Number(row.maintenanceCashInCents ?? 0) > Number(breakdown.maintenanceInCents)) return false;
        } else if (Number(row.maintenanceCashInCents ?? 0) > 0) return false;
      }
    }
  }
  return true;
}

function validCents(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\d+/g, (digits) => String(Number(digits)))
    .replace(/[^a-z0-9]/g, "");
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function mergeDatabases(current: AppDatabase, imported: AppDatabase): { database: AppDatabase; summary: ImportSummary } {
  const result = structuredClone(current);
  const summary: ImportSummary = { sectors: 0, churches: 0, collections: 0, deposits: 0, expenses: 0, schedules: 0, skipped: 0, repaired: 0 };
  const sectorIds = new Map<string, string>();
  const churchIds = new Map<string, string>();
  const scheduleIds = new Map<string, string>();

  for (const sector of imported.sectors) {
    const existing = result.sectors.find((item) => normalize(item.name) === normalize(sector.name));
    if (existing) {
      sectorIds.set(sector.id, existing.id);
      summary.skipped += 1;
    } else {
      const id = result.sectors.some((item) => item.id === sector.id) ? newId("sector") : sector.id;
      result.sectors.push({ ...sector, id });
      sectorIds.set(sector.id, id);
      summary.sectors += 1;
    }
  }

  for (const church of imported.churches) {
    const existing = result.churches.find((item) =>
      normalize(item.name) === normalize(church.name)
      || (church.code && !church.code.startsWith("TEMP-") && item.code.toLocaleLowerCase("pt-BR") === church.code.toLocaleLowerCase("pt-BR")),
    );
    if (existing) {
      churchIds.set(church.id, existing.id);
      summary.skipped += 1;
    } else {
      const id = result.churches.some((item) => item.id === church.id) ? newId("church") : church.id;
      result.churches.push({ ...church, id, sectorId: sectorIds.get(church.sectorId) ?? church.sectorId });
      churchIds.set(church.id, id);
      summary.churches += 1;
    }
  }

  for (const [importedId, actualId] of churchIds) {
    if (importedId === actualId || result.churches.some((church) => church.id === importedId)) continue;
    const repair = <T extends { churchId: string }>(items: T[]) => items.map((item) => {
      if (item.churchId !== importedId) return item;
      summary.repaired += 1;
      return { ...item, churchId: actualId };
    });
    result.collections = repair(result.collections);
    result.deposits = repair(result.deposits);
    result.expenses = repair(result.expenses);
    result.competencies = repair(result.competencies);
    result.serviceSchedules = repair(result.serviceSchedules);
    result.scheduleExceptions = repair(result.scheduleExceptions);
  }

  for (const schedule of imported.serviceSchedules ?? []) {
    const churchId = churchIds.get(schedule.churchId) ?? schedule.churchId;
    const existing = result.serviceSchedules.find((item) => item.churchId === churchId && item.weekday === schedule.weekday && item.time === schedule.time && item.meetingType === schedule.meetingType);
    if (existing) {
      scheduleIds.set(schedule.id, existing.id);
      summary.skipped += 1;
    } else {
      const id = result.serviceSchedules.some((item) => item.id === schedule.id) ? newId("schedule") : schedule.id;
      result.serviceSchedules.push({ ...schedule, id, churchId });
      scheduleIds.set(schedule.id, id);
      summary.schedules += 1;
    }
  }

  for (const exception of imported.scheduleExceptions ?? []) {
    const churchId = churchIds.get(exception.churchId) ?? exception.churchId;
    const duplicate = result.scheduleExceptions.some((item) => item.churchId === churchId && item.date === exception.date && normalize(item.description) === normalize(exception.description));
    if (duplicate) summary.skipped += 1;
    else result.scheduleExceptions.push({ ...exception, id: result.scheduleExceptions.some((item) => item.id === exception.id) ? newId("exception") : exception.id, churchId, overrides: exception.overrides.map((override) => ({ ...override, scheduleId: scheduleIds.get(override.scheduleId) ?? override.scheduleId })) });
  }

  for (const competency of imported.competencies ?? []) {
    const churchId = churchIds.get(competency.churchId) ?? competency.churchId;
    if (!result.competencies.some((item) => item.churchId === churchId && item.competency === competency.competency)) result.competencies.push({ ...competency, id: result.competencies.some((item) => item.id === competency.id) ? newId("competency") : competency.id, churchId });
  }

  for (const collection of imported.collections) {
    const churchId = churchIds.get(collection.churchId) ?? collection.churchId;
    const scheduleId = collection.serviceScheduleId ? scheduleIds.get(collection.serviceScheduleId) ?? collection.serviceScheduleId : undefined;
    const duplicate = result.collections.some((item) => item.churchId === churchId && item.competency === collection.competency && item.date === collection.date && item.meetingType === collection.meetingType && item.collectionType === collection.collectionType && item.amountInCents === collection.amountInCents);
    if (duplicate) summary.skipped += 1;
    else {
      result.collections.push({
        ...collection,
        id: result.collections.some((item) => item.id === collection.id) ? newId("collection") : collection.id,
        churchId,
        serviceScheduleId: scheduleId,
        breakdown: collection.breakdown ?? {
          pietyInCents: 0,
          maintenanceInCents: 0,
          constructionInCents: 0,
          missionsInCents: 0,
          othersInCents: collection.amountInCents,
        },
        maintenanceCashInCents: collection.maintenanceCashInCents ?? 0,
      });
      summary.collections += 1;
    }
  }

  for (const deposit of imported.deposits) {
    const churchId = churchIds.get(deposit.churchId) ?? deposit.churchId;
    const duplicate = result.deposits.some((item) =>
      (deposit.transactionNumber && item.transactionNumber.toLocaleLowerCase("pt-BR") === deposit.transactionNumber.toLocaleLowerCase("pt-BR"))
      || (item.churchId === churchId && item.competency === deposit.competency && item.amountInCents === deposit.amountInCents && item.date === deposit.date),
    );
    if (duplicate) summary.skipped += 1;
    else {
      result.deposits.push({ ...deposit, id: result.deposits.some((item) => item.id === deposit.id) ? newId("deposit") : deposit.id, churchId });
      summary.deposits += 1;
    }
  }

  for (const expense of imported.expenses) {
    const churchId = churchIds.get(expense.churchId) ?? expense.churchId;
    const duplicate = result.expenses.some((item) => item.churchId === churchId && item.competency === expense.competency && item.category === expense.category && item.amountInCents === expense.amountInCents && item.dueDate === expense.dueDate);
    if (duplicate) summary.skipped += 1;
    else {
      result.expenses.push({ ...expense, id: result.expenses.some((item) => item.id === expense.id) ? newId("expense") : expense.id, churchId, paymentSource: expense.paymentSource ?? "administration_account" });
      summary.expenses += 1;
    }
  }

  result.appliedSeeds = [...new Set([...result.appliedSeeds, ...imported.appliedSeeds])];
  return { database: result, summary };
}
