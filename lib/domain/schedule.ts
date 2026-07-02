import type {
  ScheduleException,
  ScheduledOccurrence,
  ServiceSchedule,
} from "@/lib/domain/types";

export function buildMonthlySchedule(
  churchId: string,
  competency: string,
  schedules: ServiceSchedule[],
  exceptions: ScheduleException[],
): ScheduledOccurrence[] {
  const [year, month] = competency.split("-").map(Number);
  if (!year || !month) return [];

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const churchSchedules = schedules.filter((schedule) => schedule.churchId === churchId && schedule.active);
  const churchExceptions = exceptions.filter((exception) => exception.churchId === churchId);
  const occurrences: ScheduledOccurrence[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const exception = churchExceptions.find((item) => item.date === date);

    for (const schedule of churchSchedules.filter((item) => item.weekday === weekday)) {
      const override = exception?.overrides.find((item) => item.scheduleId === schedule.id);
      if (override?.status === "cancelled") continue;

      occurrences.push({
        id: `${date}:${schedule.id}`,
        churchId,
        serviceScheduleId: schedule.id,
        date,
        time: override?.status === "changed" && override.time ? override.time : schedule.time,
        title: override?.status === "changed" && override.title ? override.title : schedule.title,
        meetingType: schedule.meetingType,
        exceptionDescription: override ? exception?.description : undefined,
      });
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
