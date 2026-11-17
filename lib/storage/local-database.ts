import type {
  AppDatabase,
  ChurchUpdate,
  DepositUpdate,
  NewCollection,
  NewExpense,
  ScheduleExceptionInput,
  ServiceScheduleInput,
} from "@/lib/domain/types";
import { fetchCloudDatabase, subscribeToCloudChanges, syncCloudChanges } from "@/lib/supabase/cloud-database";
import { assertMaintenanceLedger } from "@/lib/domain/maintenance-account";
import { databaseErrorMessage, type DatabaseStatus } from "./database-status";

const emptyDatabase: AppDatabase = {
  version: 8,
  appliedSeeds: [],
  sectors: [],
  churches: [],
  collections: [],
  deposits: [],
  competencies: [],
  serviceSchedules: [],
  scheduleExceptions: [],
  expenses: [],
};

function createId(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export class DatabaseStore {
  private cache: AppDatabase = emptyDatabase;
  private initialized = false;
  private userId = "";
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private realtimeCleanup: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly statusListeners = new Set<() => void>();
  private status: DatabaseStatus = { loading: false, saving: false, error: "" };
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private generation = 0;
  private revision = 0;
  private readSequence = 0;
  private readonly uncertain = new Map<string, { id: string; previous: AppDatabase; next: AppDatabase }>();
  constructor(private readonly cloud = { fetch: fetchCloudDatabase, sync: syncCloudChanges, subscribe: subscribeToCloudChanges }) {}

  getStatus = () => this.status;
  getServerStatus = () => serverStatus;
  subscribeStatus = (listener: () => void) => { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); };
  clearError = () => this.setStatus({ error: "" });
  private setStatus(patch: Partial<DatabaseStatus>) {
    this.status = { ...this.status, ...patch };
    this.statusListeners.forEach((listener) => listener());
  }

  getServerSnapshot = () => emptyDatabase;
  getSnapshot = () => this.cache;
  getSnapshotForUser = (userId?: string) => userId && userId !== this.userId ? emptyDatabase : this.cache;
  reset = () => {
    this.generation += 1;
    this.readSequence += 1;
    this.initialized = false;
    this.userId = "";
    this.realtimeCleanup?.();
    this.realtimeCleanup = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.uncertain.clear();
    this.persist(emptyDatabase);
    this.setStatus({ error: "", loading: false, saving: this.pending > 0 });
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(userId?: string) {
    if (typeof window === "undefined") return;
    if (userId && userId !== this.userId) {
      this.reset();
      this.userId = userId;
    }
    if (this.initialized) return;
    this.initialized = true;
    const generation = this.generation;
    try {
      await this.refreshFromCloud();
      if (generation !== this.generation) return;
      this.ensureRealtime();
    } catch (error) {
      if (generation === this.generation) this.initialized = false;
      throw error;
    }
  }

  async refreshFromCloud() {
    const generation = this.generation;
    const sequence = ++this.readSequence;
    this.setStatus({ loading: true });
    try {
      await this.queue;
      const revision = this.revision;
      const cloud = await this.cloud.fetch();
      if (generation !== this.generation || sequence !== this.readSequence || this.pending > 0 || revision !== this.revision) return false;
      this.persist(cloud ?? emptyDatabase);
      this.ensureRealtime();
      this.setStatus({ error: "" });
      return true;
    } catch (error) {
      if (generation === this.generation && sequence === this.readSequence) this.setStatus({ error: databaseErrorMessage(error) });
      throw error;
    } finally {
      if (generation === this.generation && sequence === this.readSequence) this.setStatus({ loading: false });
    }
  }

  private ensureRealtime() {
    if (this.realtimeCleanup || typeof window === "undefined") return;
    this.realtimeCleanup = this.cloud.subscribe(() => {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => { void this.refreshFromCloud().catch(() => undefined); }, 150);
    });
  }

  addCollection(input: NewCollection) {
    const now = new Date().toISOString();
    return this.update((database) => {
      this.assertOpen(database, input.churchId, input.competency);
      this.assertCollectionAllocation(input);
      const duplicate = input.serviceScheduleId && database.collections.some((collection) =>
        collection.churchId === input.churchId
        && collection.competency === input.competency
        && collection.date === input.date
        && collection.serviceScheduleId === input.serviceScheduleId,
      );
      if (duplicate) throw new Error("Já existe uma coleta registrada para este culto.");
      return {
        ...this.ensureCompetency(database, input.churchId, input.competency, now),
        collections: [...database.collections, { ...input, id: createId("collection"), createdAt: now, updatedAt: now }],
      };
    }, JSON.stringify(["addCollection", input]));
  }

  updateCollection(id: string, input: NewCollection) {
    const now = new Date().toISOString();
    return this.update((database) => {
      const current = database.collections.find((collection) => collection.id === id);
      if (current) this.assertOpen(database, current.churchId, current.competency);
      this.assertCollectionAllocation(input);
      const associationChanged = !current
        || current.serviceScheduleId !== input.serviceScheduleId
        || current.date !== input.date;
      const duplicate = associationChanged && input.serviceScheduleId && database.collections.some((collection) =>
        collection.id !== id
        && collection.churchId === input.churchId
        && collection.competency === input.competency
        && collection.date === input.date
        && collection.serviceScheduleId === input.serviceScheduleId,
      );
      if (duplicate) throw new Error("Já existe uma coleta registrada para este culto.");
      return {
        ...database,
        collections: database.collections.map((collection) => collection.id === id ? { ...collection, ...input, updatedAt: now } : collection),
      };
    }, JSON.stringify(["updateCollection", id, input]));
  }

  removeCollection(id: string) {
    return this.update((database) => {
      const collection = database.collections.find((item) => item.id === id);
      if (collection) this.assertOpen(database, collection.churchId, collection.competency);
      return { ...database, collections: database.collections.filter((item) => item.id !== id) };
    }, JSON.stringify(["removeCollection", id]));
  }

  createDeposit(churchId: string, competency: string, input: DepositUpdate, confirmed = false) {
    const now = new Date().toISOString();
    return this.update((database) => {
      this.assertOpen(database, churchId, competency);
      if (confirmed) this.assertUniqueTransaction(database, input.transactionNumber);
      return {
        ...this.ensureCompetency(database, churchId, competency, now),
        deposits: [...database.deposits, {
          ...input,
          id: createId("deposit"),
          churchId,
          competency,
          status: confirmed ? "confirmed" : "draft",
          confirmedAt: confirmed ? now : null,
          createdAt: now,
          updatedAt: now,
        }],
      };
    }, JSON.stringify(["createDeposit", churchId, competency, input, confirmed]));
  }

  updateDeposit(id: string, input: DepositUpdate) {
    const now = new Date().toISOString();
    return this.update((database) => {
      const current = database.deposits.find((deposit) => deposit.id === id);
      if (current) {
        this.assertOpen(database, current.churchId, current.competency);
        if (current.status === "confirmed") throw new Error("Depósitos confirmados são imutáveis.");
      }
      return { ...database, deposits: database.deposits.map((deposit) => deposit.id === id ? { ...deposit, ...input, updatedAt: now } : deposit) };
    }, JSON.stringify(["updateDeposit", id, input]));
  }

  confirmDeposit(id: string, input: DepositUpdate) {
    const now = new Date().toISOString();
    return this.update((database) => {
      const current = database.deposits.find((deposit) => deposit.id === id);
      if (current) this.assertOpen(database, current.churchId, current.competency);
      this.assertUniqueTransaction(database, input.transactionNumber, id);
      return { ...database, deposits: database.deposits.map((deposit) =>
        deposit.id === id
          ? { ...deposit, ...input, status: "confirmed", confirmedAt: now, updatedAt: now }
          : deposit,
      ) };
    }, JSON.stringify(["confirmDeposit", id, input]));
  }

  removeDeposit(id: string) {
    return this.update((database) => {
      const deposit = database.deposits.find((item) => item.id === id);
      if (deposit) this.assertOpen(database, deposit.churchId, deposit.competency);
      if (deposit && deposit.status !== "draft") throw new Error("Depósitos confirmados devem ser corrigidos por estorno.");
      return { ...database, deposits: database.deposits.filter((item) => item.id !== id) };
    }, JSON.stringify(["removeDeposit", id]));
  }

  reverseDeposit(id: string, reason: string) {
    return this.update((database) => {
      const deposit = database.deposits.find((item) => item.id === id);
      if (!deposit || deposit.status !== "confirmed") throw new Error("Somente depósitos confirmados podem ser estornados.");
      this.assertOpen(database, deposit.churchId, deposit.competency);
      if (reason.trim().length < 8) throw new Error("Informe um motivo com pelo menos 8 caracteres.");
      const now = new Date().toISOString();
      return { ...database, deposits: database.deposits.map((item) => item.id === id ? { ...item, status: "reversed" as const, reversalReason: reason.trim(), reversedAt: now, updatedAt: now } : item) };
    }, JSON.stringify(["reverseDeposit", id, reason.trim()]));
  }

  addExpense(input: NewExpense) {
    const now = new Date().toISOString();
    return this.update((database) => {
      return {
        ...database,
        expenses: [...database.expenses, { ...input, id: createId("expense"), createdAt: now, updatedAt: now }],
      };
    }, JSON.stringify(["addExpense", input]));
  }

  updateExpense(id: string, input: NewExpense) {
    const now = new Date().toISOString();
    return this.update((database) => {
      return { ...database, expenses: database.expenses.map((expense) => expense.id === id ? { ...expense, ...input, updatedAt: now } : expense) };
    }, JSON.stringify(["updateExpense", id, input]));
  }

  removeExpense(id: string) {
    return this.update((database) => {
      return { ...database, expenses: database.expenses.filter((item) => item.id !== id) };
    }, JSON.stringify(["removeExpense", id]));
  }

  closeCompetency(churchId: string, competency: string) {
    const now = new Date().toISOString();
    return this.update((database) => {
      const deposits = database.deposits.filter((item) => item.churchId === churchId && item.competency === competency);
      if (deposits.some((item) => item.status === "draft")) throw new Error("Existem depósitos em rascunho.");
      const monthCollections = database.collections.filter((item) => item.churchId === churchId && item.competency === competency);
      const collected = monthCollections.reduce((sum, item) => sum + item.amountInCents, 0);
      const reservedMaintenanceCash = monthCollections.reduce((sum, item) => sum + item.maintenanceCashInCents, 0);
      const deposited = deposits.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + item.amountInCents, 0);
      const expectedDeposit = collected - reservedMaintenanceCash;
      if (expectedDeposit !== deposited) throw new Error("A competência possui saldo pendente.");
      const ensured = this.ensureCompetency(database, churchId, competency, now);
      return {
        ...ensured,
        competencies: ensured.competencies.map((item) =>
          item.churchId === churchId && item.competency === competency
            ? { ...item, status: "closed", closedAt: now, updatedAt: now }
            : item,
        ),
      };
    }, JSON.stringify(["closeCompetency", churchId, competency]));
  }

  reopenCompetency(churchId: string, competency: string, reason: string) {
    const now = new Date().toISOString();
    return this.update((database) => ({
      ...database,
      competencies: database.competencies.map((item) =>
        item.churchId === churchId && item.competency === competency
          ? { ...item, status: "open", closedAt: null, reopenReason: reason.trim(), updatedAt: now }
          : item,
      ),
    }), JSON.stringify(["reopenCompetency", churchId, competency, reason.trim()]));
  }

  saveServiceSchedule(input: ServiceScheduleInput, id?: string) {
    const now = new Date().toISOString();
    return this.update((database) => ({
      ...database,
      serviceSchedules: id
        ? database.serviceSchedules.map((schedule) => schedule.id === id ? { ...schedule, ...input, updatedAt: now } : schedule)
        : [...database.serviceSchedules, { ...input, id: createId("schedule"), createdAt: now, updatedAt: now }],
    }));
  }

  removeServiceSchedule(id: string) {
    return this.update((database) => ({
      ...database,
      serviceSchedules: database.serviceSchedules.filter((schedule) => schedule.id !== id),
      scheduleExceptions: database.scheduleExceptions.map((exception) => ({
        ...exception,
        overrides: exception.overrides.filter((override) => override.scheduleId !== id),
      })),
    }));
  }

  saveScheduleException(input: ScheduleExceptionInput, id?: string) {
    const now = new Date().toISOString();
    return this.update((database) => ({
      ...database,
      scheduleExceptions: id
        ? database.scheduleExceptions.map((exception) => exception.id === id ? { ...exception, ...input, updatedAt: now } : exception)
        : [...database.scheduleExceptions, { ...input, id: createId("exception"), createdAt: now, updatedAt: now }],
    }));
  }

  removeScheduleException(id: string) {
    return this.update((database) => ({
      ...database,
      scheduleExceptions: database.scheduleExceptions.filter((exception) => exception.id !== id),
    }));
  }

  updateChurch(id: string, input: ChurchUpdate) {
    const now = new Date().toISOString();
    return this.update((database) => ({
      ...database,
      churches: database.churches.map((church) =>
        church.id === id ? { ...church, ...input, updatedAt: now } : church,
      ),
    }));
  }

  createChurch(input: ChurchUpdate) {
    const now = new Date().toISOString();
    return this.update((database) => ({
      ...database,
      churches: [
        ...database.churches,
        {
          ...input,
          id: createId("church"),
          contacts: input.contacts.map((contact) => ({ ...contact, id: createId("contact") })),
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
  }

  saveSector(name: string, id?: string) {
    const now = new Date().toISOString();
    return this.update((database) => ({
      ...database,
      sectors: id
        ? database.sectors.map((sector) => sector.id === id ? { ...sector, name, updatedAt: now } : sector)
        : [...database.sectors, { id: createId("sector"), name, createdAt: now, updatedAt: now }],
    }));
  }

  private ensureCompetency(database: AppDatabase, churchId: string, competency: string, now: string) {
    const exists = database.competencies.some((item) => item.churchId === churchId && item.competency === competency);
    if (exists) return database;
    return {
      ...database,
      competencies: [
        ...database.competencies,
        { id: createId("competency"), churchId, competency, status: "open" as const, closedAt: null, createdAt: now, updatedAt: now },
      ],
    };
  }

  private assertOpen(database: AppDatabase, churchId: string, competency: string) {
    const record = database.competencies.find((item) => item.churchId === churchId && item.competency === competency);
    if (record?.status === "closed") throw new Error("Esta competência está fechada.");
  }

  private assertUniqueTransaction(database: AppDatabase, transactionNumber: string, excludeId?: string) {
    const normalized = transactionNumber.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return;
    const duplicate = database.deposits.some((deposit) =>
      deposit.id !== excludeId
      && deposit.status === "confirmed"
      && deposit.transactionNumber.trim().toLocaleLowerCase("pt-BR") === normalized,
    );
    if (duplicate) throw new Error("Este número de comprovante já foi utilizado em outro depósito.");
  }

  private assertCollectionAllocation(input: NewCollection) {
    const breakdownTotal = input.breakdown.pietyInCents
      + input.breakdown.maintenanceInCents
      + input.breakdown.constructionInCents
      + input.breakdown.missionsInCents
      + input.breakdown.othersInCents;
    if (breakdownTotal !== input.amountInCents) {
      throw new Error("A soma do rateio da coleta deve ser igual ao valor total.");
    }
    if (input.maintenanceCashInCents > input.amountInCents) {
      throw new Error("O caixa de manutenção não pode ser maior que o valor total da coleta.");
    }
    if (input.maintenanceCashInCents > input.breakdown.maintenanceInCents) {
      throw new Error("O caixa de manutenção deve estar dentro do valor de manutenção.");
    }
  }

  private update(recipe: (database: AppDatabase) => AppDatabase, intent = crypto.randomUUID()) {
    const generation = this.generation;
    this.pending += 1;
    this.setStatus({ saving: true, error: "" });
    const task = this.queue.then(async () => {
      if (generation !== this.generation) throw new Error("A sessão mudou. Atualize os dados antes de tentar novamente.");
      this.revision += 1;
      const retry = this.uncertain.get(intent);
      const previous = retry?.previous ?? this.cache;
      const next = retry?.next ?? recipe(previous);
      assertMaintenanceLedger(next);
      const operation = retry ?? { id: crypto.randomUUID(), previous, next };
      this.uncertain.set(intent, operation);
      let receipts;
      try { receipts = await this.cloud.sync(previous, next, operation.id); }
      catch (error) {
        const code = error && typeof error === "object" ? (error as { code?: string }).code : undefined;
        if (code && (/^[A-Z0-9]{5}$/.test(code) || code === "PGRST202")) this.uncertain.delete(intent);
        throw error;
      }
      this.uncertain.delete(intent);
      if (generation !== this.generation) return;
      if (retry) {
        try {
          const current = await this.cloud.fetch();
          if (generation === this.generation) this.persist(current ?? emptyDatabase);
          return;
        } catch {
          this.setStatus({ error: "A gravação foi confirmada, mas a consulta não pôde ser atualizada. Atualize os dados antes de continuar." });
        }
      }
      const byId = new Map(receipts.map((item) => [`${item.table}:${item.id}`, item]));
      const tables = { sectors: "sectors", churches: "churches", collections: "collections", deposits: "deposits", competencies: "monthly_competencies", serviceSchedules: "service_schedules", scheduleExceptions: "schedule_exceptions", expenses: "expenses" } as const;
      const confirmed = { ...this.cache };
      for (const [key, table] of Object.entries(tables) as Array<[keyof typeof tables, string]>) {
        const previousById = new Map(previous[key].map((row) => [row.id, JSON.stringify(row)]));
        const nextIds = new Set(next[key].map((row) => row.id));
        const removed = new Set(previous[key].filter((row) => !nextIds.has(row.id)).map((row) => row.id));
        const changed = next[key].filter((row) => previousById.get(row.id) !== JSON.stringify(row));
        const changedIds = new Set(changed.map((row) => row.id));
        Object.assign(confirmed, { [key]: [...this.cache[key].filter((row) => !removed.has(row.id) && !changedIds.has(row.id)), ...changed.map((row) => {
          const receipt = byId.get(`${table}:${row.id}`);
          return receipt ? { ...row, createdAt: receipt.created_at, updatedAt: receipt.updated_at } : row;
        })] });
      }
      this.persist(confirmed);
    }).catch((error: unknown) => {
      if (generation === this.generation) this.setStatus({ error: databaseErrorMessage(error) });
      throw new Error(databaseErrorMessage(error));
    }).finally(() => { this.pending -= 1; this.setStatus({ saving: this.pending > 0 }); });
    this.queue = task.catch(() => undefined);
    return task;
  }

  private persist(database: AppDatabase) {
    this.cache = database;
    this.listeners.forEach((listener) => listener());
  }
}

const serverStatus: DatabaseStatus = { loading: false, saving: false, error: "" };
export const databaseStore = new DatabaseStore();
