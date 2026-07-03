import type { AppDatabase, Church, Expense } from "@/lib/domain/types";

const createdAt = "2026-07-02T12:00:00.000Z";

function mockChurch(id: string, name: string, code: string): Church {
  return {
    id,
    sectorId: "sector-brazlandia",
    name,
    code,
    address: "",
    latitude: "",
    longitude: "",
    contacts: [
      { id: `${id}-maintenance`, name: "", role: "Responsável caixa de manutenção" },
      { id: `${id}-assistant`, name: "", role: "Auxiliar" },
      { id: `${id}-cooperator`, name: "", role: "Cooperador" },
      { id: `${id}-rjm`, name: "", role: "Cooperador de jovens e menores" },
    ],
    active: true,
    createdAt,
    updatedAt: createdAt,
  };
}

const utilityExpenses: Expense[] = [
  { churchId: "church-central", category: "Energia elétrica", values: [40557, 29597, 23170, 35128] },
  { churchId: "church-incra-07", category: "Energia elétrica", values: [9452, 8073, 8853, 11272] },
  { churchId: "church-incra-08", category: "Energia elétrica", values: [15043, 8786, 8913, 13250] },
  { churchId: "church-setor-veredas", category: "Energia elétrica", values: [18906, 16527, 16329, 18409] },
  { churchId: "church-vila-sao-jose", category: "Energia elétrica", values: [13064, 12771, 13827, 11888] },
  { churchId: "church-central", category: "Água", values: [10254, 11906, 8602, 8602, 7776] },
  { churchId: "church-incra-08", category: "Água", values: [4714, 69040, 7192, 8018, 9010] },
  { churchId: "church-setor-veredas", category: "Água", values: [8602, 7776, 7776, 6950, 7776] },
  { churchId: "church-vila-sao-jose", category: "Água", values: [3888, 4714, 3888, 3888, 4714] },
].flatMap(({ churchId, category, values }) => values.map((amountInCents, index): Expense => {
  const month = index + 1;
  const competency = `2026-${String(month).padStart(2, "0")}`;
  const dueDate = new Date(Date.UTC(2026, month, 15)).toISOString().slice(0, 10);
  const slug = category === "Água" ? "water" : "energy";
  return {
    id: `mock-expense-${churchId}-${slug}-${String(month).padStart(2, "0")}`,
    churchId,
    competency,
    dueDate,
    paymentDate: dueDate,
    status: "paid",
    paymentMethod: "automatic_debit",
    description: `${category} - referência ${String(month).padStart(2, "0")}/2026`,
    category,
    amountInCents,
    payee: category === "Água" ? "Concessionária de água" : "Concessionária de energia",
    documentNumber: "",
    notes: "Dados iniciais importados da planilha; cadastro ajustável.",
    createdAt,
    updatedAt: createdAt,
  };
}));

export const seedDatabase: AppDatabase = {
  version: 8,
  appliedSeeds: ["utility-expenses-2026"],
  sectors: [
    {
      id: "sector-brazlandia",
      name: "Brazlândia",
      createdAt,
      updatedAt: createdAt,
    },
  ],
  churches: [
    {
      id: "church-incra-08",
      sectorId: "sector-brazlandia",
      name: "Incra 08",
      code: "24-0010",
      address: "",
      latitude: "",
      longitude: "",
      contacts: [
        { id: "contact-carlos", name: "Carlos Duarte", role: "Responsável caixa de manutenção" },
        { id: "contact-breno", name: "Breno Soares", role: "Auxiliar" },
        { id: "contact-tiao", name: "Tião", role: "Cooperador" },
        { id: "contact-samuel", name: "Samuel", role: "Cooperador de jovens e menores" },
      ],
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
    mockChurch("church-central", "Central", "TEMP-CENTRAL"),
    mockChurch("church-incra-07", "Incra 07", "TEMP-INCRA-07"),
    mockChurch("church-setor-veredas", "Setor Veredas", "TEMP-VEREDAS"),
    mockChurch("church-vila-sao-jose", "Vila São José", "TEMP-VILA-SJ"),
  ],
  collections: [],
  deposits: [],
  competencies: [],
  serviceSchedules: [
    {
      id: "schedule-incra-friday",
      churchId: "church-incra-08",
      weekday: 5,
      time: "19:30",
      meetingType: "culto",
      title: "Culto oficial",
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "schedule-incra-sunday-rjm",
      churchId: "church-incra-08",
      weekday: 0,
      time: "10:00",
      meetingType: "rjm",
      title: "Reunião de jovens e menores",
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "schedule-incra-sunday-evening",
      churchId: "church-incra-08",
      weekday: 0,
      time: "19:00",
      meetingType: "culto",
      title: "Culto oficial",
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
  ],
  scheduleExceptions: [
    {
      id: "exception-incra-2026-10-04",
      churchId: "church-incra-08",
      date: "2026-10-04",
      description: "Santa Ceia",
      overrides: [
        { scheduleId: "schedule-incra-sunday-rjm", status: "cancelled" },
        { scheduleId: "schedule-incra-sunday-evening", status: "changed", title: "Santa Ceia", time: "19:00" },
      ],
      createdAt,
      updatedAt: createdAt,
    },
  ],
  expenses: utilityExpenses,
};
