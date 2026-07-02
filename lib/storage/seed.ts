import type { AppDatabase } from "@/lib/domain/types";

const createdAt = "2026-07-02T12:00:00.000Z";

export const seedDatabase: AppDatabase = {
  version: 3,
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
};
