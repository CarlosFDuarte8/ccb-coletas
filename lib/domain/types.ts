export type EntityId = string;

export type Sector = {
  id: EntityId;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ChurchContactRole =
  | "Responsável caixa de manutenção"
  | "Auxiliar"
  | "Cooperador"
  | "Cooperador de jovens e menores";

export type ChurchContact = {
  id: EntityId;
  name: string;
  role: ChurchContactRole;
};

export type Church = {
  id: EntityId;
  sectorId: EntityId;
  name: string;
  code: string;
  address: string;
  latitude: string;
  longitude: string;
  contacts: ChurchContact[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MeetingType = "culto" | "rjm";
export type CollectionType = "normal" | "especial";

export type CollectionBreakdown = {
  pietyInCents: number;
  maintenanceInCents: number;
  constructionInCents: number;
  missionsInCents: number;
  othersInCents: number;
};

export type Collection = {
  id: EntityId;
  churchId: EntityId;
  competency: string;
  date: string;
  meetingType: MeetingType;
  collectionType: CollectionType;
  amountInCents: number;
  notes: string;
  serviceScheduleId?: EntityId;
  serviceTime?: string;
  breakdown: CollectionBreakdown;
  maintenanceCashInCents: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledOccurrence = {
  id: string;
  churchId: EntityId;
  serviceScheduleId: EntityId;
  date: string;
  time: string;
  title: string;
  meetingType: MeetingType;
  exceptionDescription?: string;
};

export type DenominationCount = Record<string, number>;

export type Deposit = {
  id: EntityId;
  churchId: EntityId;
  competency: string;
  date: string;
  transactionNumber: string;
  amountInCents: number;
  denominationCounts: DenominationCount;
  notes: string;
  status: "draft" | "confirmed" | "reversed";
  confirmedAt: string | null;
  reversedAt?: string | null;
  reversalReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyCompetency = {
  id: EntityId;
  churchId: EntityId;
  competency: string;
  status: "open" | "closed";
  closedAt: string | null;
  reopenReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceSchedule = {
  id: EntityId;
  churchId: EntityId;
  weekday: number;
  time: string;
  meetingType: MeetingType;
  title: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleOverride = {
  scheduleId: EntityId;
  status: "cancelled" | "changed";
  title?: string;
  time?: string;
};

export type ScheduleException = {
  id: EntityId;
  churchId: EntityId;
  date: string;
  description: string;
  overrides: ScheduleOverride[];
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: EntityId;
  churchId: EntityId;
  competency: string;
  dueDate: string;
  paymentDate: string;
  status: "pending" | "paid";
  paymentSource: "administration_account" | "maintenance_cash";
  paymentMethod: "automatic_debit" | "pix" | "bank_slip" | "cash" | "transfer" | "other" | "not_informed";
  description: string;
  category: string;
  amountInCents: number;
  payee: string;
  documentNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AppDatabase = {
  version: 8;
  appliedSeeds: string[];
  sectors: Sector[];
  churches: Church[];
  collections: Collection[];
  deposits: Deposit[];
  competencies: MonthlyCompetency[];
  serviceSchedules: ServiceSchedule[];
  scheduleExceptions: ScheduleException[];
  expenses: Expense[];
};

export type NewCollection = Omit<Collection, "id" | "createdAt" | "updatedAt">;
export type NewDeposit = Omit<Deposit, "id" | "createdAt" | "updatedAt">;
export type DepositUpdate = Pick<Deposit, "date" | "transactionNumber" | "amountInCents" | "denominationCounts" | "notes">;
export type ServiceScheduleInput = Pick<ServiceSchedule, "churchId" | "weekday" | "time" | "meetingType" | "title" | "active">;
export type ScheduleExceptionInput = Pick<ScheduleException, "churchId" | "date" | "description" | "overrides">;
export type NewExpense = Omit<Expense, "id" | "createdAt" | "updatedAt">;
export type ChurchUpdate = Pick<Church, "name" | "code" | "sectorId" | "address" | "latitude" | "longitude" | "contacts">;
