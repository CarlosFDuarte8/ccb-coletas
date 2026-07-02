import type {
  AppDatabase,
  ChurchUpdate,
  Deposit,
  DepositUpdate,
  NewCollection,
  ScheduleExceptionInput,
  ServiceScheduleInput,
} from "@/lib/domain/types";
import { seedDatabase } from "./seed";

const STORAGE_KEY = "ccb-coletas:database:v1";

function cloneSeed(): AppDatabase {
  return structuredClone(seedDatabase);
}

function createId(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function migrateDatabase(stored: Partial<AppDatabase> & { deposits?: Partial<Deposit>[] }): AppDatabase {
  const fallback = cloneSeed();
  const isLegacy = stored.version !== 3;
  return {
    version: 3,
    sectors: stored.sectors ?? fallback.sectors,
    churches: stored.churches ?? fallback.churches,
    collections: stored.collections ?? [],
    deposits: (stored.deposits ?? []).map((deposit) => ({
      ...deposit,
      status: deposit.status ?? "confirmed",
      confirmedAt: deposit.confirmedAt ?? deposit.createdAt ?? null,
    })) as Deposit[],
    competencies: stored.competencies ?? [],
    serviceSchedules: isLegacy ? fallback.serviceSchedules : (stored.serviceSchedules ?? []),
    scheduleExceptions: isLegacy ? fallback.scheduleExceptions : (stored.scheduleExceptions ?? []),
  };
}

class LocalDatabase {
  private cache: AppDatabase | null = null;
  private readonly listeners = new Set<() => void>();

  getServerSnapshot = () => seedDatabase;

  getSnapshot = () => {
    if (this.cache) return this.cache;
    if (typeof window === "undefined") return seedDatabase;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      this.cache = stored ? migrateDatabase(JSON.parse(stored)) : cloneSeed();
    } catch {
      this.cache = cloneSeed();
    }
    return this.cache;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize() {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored || JSON.parse(stored).version !== 3) this.persist(this.getSnapshot());
    } catch {
      this.persist(this.getSnapshot());
    }
  }

  addCollection(input: NewCollection) {
    const now = new Date().toISOString();
    this.update((database) => {
      this.assertOpen(database, input.churchId, input.competency);
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

  closeCompetency(churchId: string, competency: string) {
    const now = new Date().toISOString();
    this.update((database) => {
      const deposits = database.deposits.filter((item) => item.churchId === churchId && item.competency === competency);
      if (deposits.some((item) => item.status === "draft")) throw new Error("Existem depósitos em rascunho.");
      const collected = database.collections.filter((item) => item.churchId === churchId && item.competency === competency).reduce((sum, item) => sum + item.amountInCents, 0);
      const deposited = deposits.reduce((sum, item) => sum + item.amountInCents, 0);
      if (collected !== deposited) throw new Error("A competência possui saldo pendente.");
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

  private update(recipe: (database: AppDatabase) => AppDatabase) {
    this.persist(recipe(this.getSnapshot()));
  }

  private persist(database: AppDatabase) {
    this.cache = database;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
    this.listeners.forEach((listener) => listener());
  }
}

export const localDatabase = new LocalDatabase();
