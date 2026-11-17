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

class DatabaseStore {
  private cache: AppDatabase = emptyDatabase;
  private initialized = false;
  private userId = "";
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private realtimeCleanup: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();

  getServerSnapshot = () => emptyDatabase;
  getSnapshot = () => this.cache;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(userId?: string) {
    if (typeof window === "undefined") return;
    if (userId && userId !== this.userId) {
      this.userId = userId;
      this.initialized = false;
      this.realtimeCleanup?.();
      this.realtimeCleanup = null;
      this.persist(emptyDatabase, false);
    }
    if (this.initialized) return;
    this.initialized = true;
    try {
      await this.refreshFromCloud();
      this.realtimeCleanup = subscribeToCloudChanges(() => {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => { void this.refreshFromCloud(); }, 150);
      });
    } catch (error) {
      this.initialized = false;
      throw error;
    }
  }

  async refreshFromCloud() {
    if (typeof window === "undefined") return false;
    const cloud = await fetchCloudDatabase();
    if (!cloud) {
      this.persist(emptyDatabase, false);
      return true;
    }
    this.persist(cloud, false);
    return true;
  }

  addCollection(input: NewCollection) {
    const now = new Date().toISOString();
    this.update((database) => {
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
    });
  }

  updateCollection(id: string, input: NewCollection) {
    const now = new Date().toISOString();
    this.update((database) => {
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
    });
  }

  removeCollection(id: string) {
    this.update((database) => {
      const collection = database.collections.find((item) => item.id === id);
      if (collection) this.assertOpen(database, collection.churchId, collection.competency);
      return { ...database, collections: database.collections.filter((item) => item.id !== id) };
    });
  }

  createDeposit(churchId: string, competency: string, input: DepositUpdate, confirmed = false) {
    const now = new Date().toISOString();
    this.update((database) => {
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
    });
  }

  updateDeposit(id: string, input: DepositUpdate) {
    const now = new Date().toISOString();
    this.update((database) => {
      const current = database.deposits.find((deposit) => deposit.id === id);
      if (current) {
        this.assertOpen(database, current.churchId, current.competency);
        if (current.status === "confirmed") throw new Error("Depósitos confirmados são imutáveis.");
      }
      return { ...database, deposits: database.deposits.map((deposit) => deposit.id === id ? { ...deposit, ...input, updatedAt: now } : deposit) };
    });
  }

  confirmDeposit(id: string, input: DepositUpdate) {
    const now = new Date().toISOString();
    this.update((database) => {
      const current = database.deposits.find((deposit) => deposit.id === id);
      if (current) this.assertOpen(database, current.churchId, current.competency);
      this.assertUniqueTransaction(database, input.transactionNumber, id);
      return { ...database, deposits: database.deposits.map((deposit) =>
        deposit.id === id
          ? { ...deposit, ...input, status: "confirmed", confirmedAt: now, updatedAt: now }
          : deposit,
      ) };
    });
  }

  removeDeposit(id: string) {
    this.update((database) => {
      const deposit = database.deposits.find((item) => item.id === id);
      if (deposit) this.assertOpen(database, deposit.churchId, deposit.competency);
      return { ...database, deposits: database.deposits.filter((item) => item.id !== id) };
    });
  }

  addExpense(input: NewExpense) {
    const now = new Date().toISOString();
    this.update((database) => {
      if (input.status === "paid" && input.paymentSource === "maintenance_cash") {
        this.assertMaintenanceCashAvailability(database, input.churchId, input.competency, input.amountInCents);
      }
      return {
        ...database,
        expenses: [...database.expenses, { ...input, id: createId("expense"), createdAt: now, updatedAt: now }],
      };
    });
  }

  updateExpense(id: string, input: NewExpense) {
    const now = new Date().toISOString();
    this.update((database) => {
      const current = database.expenses.find((expense) => expense.id === id);
      const originalAmount = current?.status === "paid" && current.paymentSource === "maintenance_cash"
        ? current.amountInCents
        : 0;
      if (input.status === "paid" && input.paymentSource === "maintenance_cash") {
        this.assertMaintenanceCashAvailability(database, input.churchId, input.competency, input.amountInCents - originalAmount);
      }
      return { ...database, expenses: database.expenses.map((expense) => expense.id === id ? { ...expense, ...input, updatedAt: now } : expense) };
    });
  }

  removeExpense(id: string) {
    this.update((database) => {
      return { ...database, expenses: database.expenses.filter((item) => item.id !== id) };
    });
  }

  closeCompetency(churchId: string, competency: string) {
    const now = new Date().toISOString();
    this.update((database) => {
      const deposits = database.deposits.filter((item) => item.churchId === churchId && item.competency === competency);
      if (deposits.some((item) => item.status === "draft")) throw new Error("Existem depósitos em rascunho.");
      const monthCollections = database.collections.filter((item) => item.churchId === churchId && item.competency === competency);
      const collected = monthCollections.reduce((sum, item) => sum + item.amountInCents, 0);
      const reservedMaintenanceCash = monthCollections.reduce((sum, item) => sum + item.maintenanceCashInCents, 0);
      const spentMaintenanceCash = this.paidMaintenanceCash(database, churchId, competency);
      if (spentMaintenanceCash > reservedMaintenanceCash) {
        throw new Error("As despesas pagas pelo caixa de manutenção ultrapassam o valor reservado nas coletas.");
      }
      const deposited = deposits.reduce((sum, item) => sum + item.amountInCents, 0);
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
    });
  }

  reopenCompetency(churchId: string, competency: string) {
    const now = new Date().toISOString();
    this.update((database) => ({
      ...database,
      competencies: database.competencies.map((item) =>
        item.churchId === churchId && item.competency === competency
          ? { ...item, status: "open", closedAt: null, updatedAt: now }
          : item,
      ),
    }));
  }

  saveServiceSchedule(input: ServiceScheduleInput, id?: string) {
    const now = new Date().toISOString();
    this.update((database) => ({
      ...database,
      serviceSchedules: id
        ? database.serviceSchedules.map((schedule) => schedule.id === id ? { ...schedule, ...input, updatedAt: now } : schedule)
        : [...database.serviceSchedules, { ...input, id: createId("schedule"), createdAt: now, updatedAt: now }],
    }));
  }

  removeServiceSchedule(id: string) {
    this.update((database) => ({
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
    this.update((database) => ({
      ...database,
      scheduleExceptions: id
        ? database.scheduleExceptions.map((exception) => exception.id === id ? { ...exception, ...input, updatedAt: now } : exception)
        : [...database.scheduleExceptions, { ...input, id: createId("exception"), createdAt: now, updatedAt: now }],
    }));
  }

  removeScheduleException(id: string) {
    this.update((database) => ({
      ...database,
      scheduleExceptions: database.scheduleExceptions.filter((exception) => exception.id !== id),
    }));
  }

  updateChurch(id: string, input: ChurchUpdate) {
    const now = new Date().toISOString();
    this.update((database) => ({
      ...database,
      churches: database.churches.map((church) =>
        church.id === id ? { ...church, ...input, updatedAt: now } : church,
      ),
    }));
  }

  createChurch(input: ChurchUpdate) {
    const now = new Date().toISOString();
    this.update((database) => ({
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
    this.update((database) => ({
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

  private maintenanceCashReserved(database: AppDatabase, churchId: string, competency: string) {
    return database.collections
      .filter((item) => item.churchId === churchId && item.competency === competency)
      .reduce((sum, item) => sum + item.maintenanceCashInCents, 0);
  }

  private paidMaintenanceCash(database: AppDatabase, churchId: string, competency: string) {
    return database.expenses
      .filter((item) => item.churchId === churchId && item.competency === competency && item.status === "paid" && item.paymentSource === "maintenance_cash")
      .reduce((sum, item) => sum + item.amountInCents, 0);
  }

  private assertMaintenanceCashAvailability(database: AppDatabase, churchId: string, competency: string, extraAmountInCents: number) {
    if (extraAmountInCents <= 0) return;
    const reserved = this.maintenanceCashReserved(database, churchId, competency);
    const alreadyPaid = this.paidMaintenanceCash(database, churchId, competency);
    if (alreadyPaid + extraAmountInCents > reserved) {
      throw new Error("O caixa de manutenção desta competência não possui saldo suficiente para esta despesa.");
    }
  }

  private update(recipe: (database: AppDatabase) => AppDatabase) {
    this.persist(recipe(this.getSnapshot()));
  }

  private persist(database: AppDatabase, sync = true) {
    const previous = this.cache;
    this.cache = database;
    this.listeners.forEach((listener) => listener());
    if (sync) {
      void syncCloudChanges(previous, database).catch(() => {
        void this.refreshFromCloud().catch(() => undefined);
      });
    }
  }
}

export const databaseStore = new DatabaseStore();
