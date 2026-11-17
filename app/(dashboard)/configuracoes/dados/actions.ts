"use server";

import type { AppDatabase } from "@/lib/domain/types";
import { isDatabaseFile, type ImportSummary } from "@/lib/storage/database-import";
import { requireSuperAdmin } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export type CloudMigrationResult = { success: true; message: string; summary: ImportSummary } | { success: false; message: string };

function normalizeInput(input: Partial<AppDatabase>): AppDatabase {
  return {
    version: 8,
    appliedSeeds: input.appliedSeeds ?? [],
    sectors: input.sectors ?? [],
    churches: input.churches ?? [],
    collections: (input.collections ?? []).map((item) => ({
      ...item,
      breakdown: item.breakdown ?? {
        pietyInCents: 0,
        maintenanceInCents: 0,
        constructionInCents: 0,
        missionsInCents: 0,
        othersInCents: item.amountInCents,
      },
      maintenanceCashInCents: item.maintenanceCashInCents ?? 0,
    })),
    deposits: input.deposits ?? [],
    competencies: input.competencies ?? [],
    serviceSchedules: input.serviceSchedules ?? [],
    scheduleExceptions: input.scheduleExceptions ?? [],
    expenses: (input.expenses ?? []).map((item) => ({
      ...item,
      paymentSource: item.paymentSource ?? "administration_account",
    })),
  };
}

export async function importDatabaseToCloud(input: Partial<AppDatabase>, mode: "merge" | "replace" = "merge"): Promise<CloudMigrationResult> {
  await requireSuperAdmin();
  if (!isDatabaseFile(input)) return { success: false, message: "Os dados locais não possuem um formato válido." };
  const database = normalizeInput(input);
  if (database.sectors.length > 500 || database.churches.length > 5000 || database.collections.length > 100_000) {
    return { success: false, message: "O volume enviado excede o limite de uma migração manual." };
  }

  const supabase = await createClient();
  const operations: Array<{ table: string; rows: Record<string, unknown>[] }> = [
    { table: "sectors", rows: database.sectors.map((item) => ({ id: item.id, name: item.name, created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "churches", rows: database.churches.map((item) => ({ id: item.id, sector_id: item.sectorId, name: item.name, code: item.code, address: item.address, latitude: item.latitude, longitude: item.longitude, contacts: item.contacts, active: item.active, created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "service_schedules", rows: database.serviceSchedules.map((item) => ({ id: item.id, church_id: item.churchId, weekday: item.weekday, time: item.time, meeting_type: item.meetingType, title: item.title, active: item.active, created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "schedule_exceptions", rows: database.scheduleExceptions.map((item) => ({ id: item.id, church_id: item.churchId, date: item.date, description: item.description, overrides: item.overrides, created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "collections", rows: database.collections.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, date: item.date, meeting_type: item.meetingType, collection_type: item.collectionType, amount_in_cents: item.amountInCents, notes: item.notes, service_schedule_id: item.serviceScheduleId ?? null, service_time: item.serviceTime ?? null, breakdown: { piety_in_cents: item.breakdown.pietyInCents, maintenance_in_cents: item.breakdown.maintenanceInCents, construction_in_cents: item.breakdown.constructionInCents, missions_in_cents: item.breakdown.missionsInCents, others_in_cents: item.breakdown.othersInCents }, maintenance_cash_in_cents: item.maintenanceCashInCents, created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "deposits", rows: database.deposits.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, date: item.date || null, transaction_number: item.transactionNumber, amount_in_cents: item.amountInCents, denomination_counts: item.denominationCounts, notes: item.notes, status: item.status, confirmed_at: item.confirmedAt, reversed_at: item.reversedAt ?? null, reversal_reason: item.reversalReason ?? "", created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "expenses", rows: database.expenses.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, due_date: item.dueDate || null, payment_date: item.paymentDate || null, status: item.status, payment_source: item.paymentSource, payment_method: item.paymentMethod, description: item.description, category: item.category, amount_in_cents: item.amountInCents, payee: item.payee, document_number: item.documentNumber, notes: item.notes, created_at: item.createdAt, updated_at: item.updatedAt })) },
    { table: "monthly_competencies", rows: database.competencies.map((item) => ({ id: item.id, church_id: item.churchId, competency: item.competency, status: item.status, closed_at: item.closedAt, reopen_reason: item.reopenReason ?? "", created_at: item.createdAt, updated_at: item.updatedAt })) },
  ];

  const { data, error } = await supabase.rpc("import_database", { operations, replace_existing: mode === "replace" });
  if (error) return { success: false, message: `A importação foi desfeita: ${error.message}` };
  const counts = data?.counts ?? {};
  const summary: ImportSummary = { sectors: counts.sectors ?? 0, churches: counts.churches ?? 0, collections: counts.collections ?? 0, deposits: counts.deposits ?? 0, expenses: counts.expenses ?? 0, schedules: counts.service_schedules ?? 0, skipped: data?.skipped ?? 0, repaired: 0 };
  return {
    success: true,
    message: "Importação confirmada pelo banco.",
    summary,
  };
}
