import type { AppDatabase } from "@/lib/domain/types";
import { createClient } from "./client";

type Row = Record<string, unknown>;

const text = (value: unknown) => typeof value === "string" ? value : "";
const cents = (value: unknown) => Number(value ?? 0);
const timestamp = (value: unknown) => text(value) || new Date().toISOString();
const shortTime = (value: unknown) => text(value).slice(0, 5);

function normalizeBreakdown(value: unknown, amountInCents: number): AppDatabase["collections"][number]["breakdown"] {
  const input = (value && typeof value === "object") ? value as Record<string, unknown> : {};
  const pietyInCents = cents(input.piety_in_cents);
  const maintenanceInCents = cents(input.maintenance_in_cents);
  const constructionInCents = cents(input.construction_in_cents);
  const missionsInCents = cents(input.missions_in_cents);
  const othersInCents = cents(input.others_in_cents);
  const total = pietyInCents + maintenanceInCents + constructionInCents + missionsInCents + othersInCents;
  if (total === amountInCents) {
    return { pietyInCents, maintenanceInCents, constructionInCents, missionsInCents, othersInCents };
  }
  return {
    pietyInCents: 0,
    maintenanceInCents: 0,
    constructionInCents: 0,
    missionsInCents: 0,
    othersInCents: amountInCents,
  };
}

export async function fetchCloudDatabase(): Promise<AppDatabase | null> {
  const supabase = createClient();
  const results = await Promise.all([
    supabase.from("sectors").select("*"),
    supabase.from("churches").select("*"),
    supabase.from("collections").select("*"),
    supabase.from("deposits").select("*"),
    supabase.from("monthly_competencies").select("*"),
    supabase.from("service_schedules").select("*"),
    supabase.from("schedule_exceptions").select("*"),
    supabase.from("expenses").select("*"),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;

  const [sectors, churches, collections, deposits, competencies, schedules, exceptions, expenses] = results.map((result) => (result.data ?? []) as Row[]);
  if (sectors.length === 0 && churches.length === 0) return null;

  return {
    version: 8,
    appliedSeeds: ["supabase-cloud"],
    sectors: sectors.map((row) => ({
      id: text(row.id), name: text(row.name), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
    churches: churches.map((row) => ({
      id: text(row.id), sectorId: text(row.sector_id), name: text(row.name), code: text(row.code), address: text(row.address),
      latitude: text(row.latitude), longitude: text(row.longitude), contacts: Array.isArray(row.contacts) ? row.contacts as never[] : [],
      active: row.active !== false, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
    collections: collections.map((row) => {
      const amountInCents = cents(row.amount_in_cents);
      return {
        id: text(row.id), churchId: text(row.church_id), competency: text(row.competency), date: text(row.date),
        meetingType: row.meeting_type as "culto" | "rjm", collectionType: row.collection_type as "normal" | "especial",
        amountInCents, notes: text(row.notes), serviceScheduleId: text(row.service_schedule_id) || undefined,
        serviceTime: shortTime(row.service_time) || undefined,
        breakdown: normalizeBreakdown(row.breakdown, amountInCents),
        maintenanceCashInCents: cents(row.maintenance_cash_in_cents),
        createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
      };
    }),
    deposits: deposits.map((row) => ({
      id: text(row.id), churchId: text(row.church_id), competency: text(row.competency), date: text(row.date),
      transactionNumber: text(row.transaction_number), amountInCents: cents(row.amount_in_cents),
      denominationCounts: (row.denomination_counts ?? {}) as Record<string, number>, notes: text(row.notes),
      status: row.status as "draft" | "confirmed", confirmedAt: text(row.confirmed_at) || null,
      createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
    competencies: competencies.map((row) => ({
      id: text(row.id), churchId: text(row.church_id), competency: text(row.competency), status: row.status as "open" | "closed",
      closedAt: text(row.closed_at) || null, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
    serviceSchedules: schedules.map((row) => ({
      id: text(row.id), churchId: text(row.church_id), weekday: Number(row.weekday), time: shortTime(row.time),
      meetingType: row.meeting_type as "culto" | "rjm", title: text(row.title), active: row.active !== false,
      createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
    scheduleExceptions: exceptions.map((row) => ({
      id: text(row.id), churchId: text(row.church_id), date: text(row.date), description: text(row.description),
      overrides: Array.isArray(row.overrides) ? row.overrides as never[] : [], createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
    expenses: expenses.map((row) => ({
      id: text(row.id), churchId: text(row.church_id), competency: text(row.competency), dueDate: text(row.due_date),
      paymentDate: text(row.payment_date), status: row.status as "pending" | "paid", paymentSource: (text(row.payment_source) || "administration_account") as AppDatabase["expenses"][number]["paymentSource"], paymentMethod: row.payment_method as AppDatabase["expenses"][number]["paymentMethod"],
      description: text(row.description), category: text(row.category), amountInCents: cents(row.amount_in_cents), payee: text(row.payee),
      documentNumber: text(row.document_number), notes: text(row.notes), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
    })),
  };
}

function rowsByTable(database: AppDatabase): Record<string, Record<string, unknown>[]> {
  return {
    sectors: database.sectors.map((item) => ({ id: item.id, name: item.name, created_at: item.createdAt, updated_at: item.updatedAt })),
    churches: database.churches.map((item) => ({ id: item.id, sector_id: item.sectorId, name: item.name, code: item.code, address: item.address, latitude: item.latitude, longitude: item.longitude, contacts: item.contacts, active: item.active, created_at: item.createdAt, updated_at: item.updatedAt })),
    service_schedules: database.serviceSchedules.map((item) => ({ id: item.id, church_id: item.churchId, weekday: item.weekday, time: item.time, meeting_type: item.meetingType, title: item.title, active: item.active, created_at: item.createdAt, updated_at: item.updatedAt })),
    schedule_exceptions: database.scheduleExceptions.map((item) => ({ id: item.id, church_id: item.churchId, date: item.date, description: item.description, overrides: item.overrides, created_at: item.createdAt, updated_at: item.updatedAt })),
    monthly_competencies: database.competencies.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, status: item.status, closed_at: item.closedAt, created_at: item.createdAt, updated_at: item.updatedAt })),
    collections: database.collections.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, date: item.date, meeting_type: item.meetingType, collection_type: item.collectionType, amount_in_cents: item.amountInCents, notes: item.notes, service_schedule_id: item.serviceScheduleId ?? null, service_time: item.serviceTime ?? null, breakdown: { piety_in_cents: item.breakdown.pietyInCents, maintenance_in_cents: item.breakdown.maintenanceInCents, construction_in_cents: item.breakdown.constructionInCents, missions_in_cents: item.breakdown.missionsInCents, others_in_cents: item.breakdown.othersInCents }, maintenance_cash_in_cents: item.maintenanceCashInCents, created_at: item.createdAt, updated_at: item.updatedAt })),
    deposits: database.deposits.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, date: item.date, transaction_number: item.transactionNumber, amount_in_cents: item.amountInCents, denomination_counts: item.denominationCounts, notes: item.notes, status: item.status, confirmed_at: item.confirmedAt, created_at: item.createdAt, updated_at: item.updatedAt })),
    expenses: database.expenses.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, due_date: item.dueDate || null, payment_date: item.paymentDate || null, status: item.status, payment_source: item.paymentSource, payment_method: item.paymentMethod, description: item.description, category: item.category, amount_in_cents: item.amountInCents, payee: item.payee, document_number: item.documentNumber, notes: item.notes, created_at: item.createdAt, updated_at: item.updatedAt })),
  };
}

export async function syncCloudChanges(previous: AppDatabase, current: AppDatabase) {
  const supabase = createClient();
  const before = rowsByTable(previous);
  const after = rowsByTable(current);
  const tableOrder = ["sectors", "churches", "service_schedules", "schedule_exceptions", "monthly_competencies", "collections", "deposits", "expenses"];

  for (const table of tableOrder) {
    const previousById = new Map(before[table].map((row) => [String(row.id), JSON.stringify(row)]));
    const changed = after[table].filter((row) => previousById.get(String(row.id)) !== JSON.stringify(row));
    if (changed.length === 0) continue;
    const { error } = await supabase.from(table).upsert(changed, { onConflict: "id" });
    if (error) throw error;
  }

  for (const table of [...tableOrder].reverse()) {
    const currentIds = new Set(after[table].map((row) => String(row.id)));
    const removedIds = before[table].map((row) => String(row.id)).filter((id) => !currentIds.has(id));
    if (removedIds.length === 0) continue;
    const { error } = await supabase.from(table).delete().in("id", removedIds);
    if (error) throw error;
  }
}

export function subscribeToCloudChanges(onChange: () => void) {
  const supabase = createClient();
  const channel = supabase
    .channel("ccb-database-changes")
    .on("postgres_changes", { event: "*", schema: "public" }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
