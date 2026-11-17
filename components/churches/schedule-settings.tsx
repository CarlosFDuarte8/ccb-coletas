"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowUpRightIcon, CalendarIcon, ClockIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { useDatabase } from "@/hooks/use-database";
import type { ScheduleException, ScheduleOverride, ServiceSchedule } from "@/lib/domain/types";
import { databaseStore } from "@/lib/storage/database-store";

const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

type Editor = { type: "schedule" | "exception"; id?: string } | null;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function ScheduleSettings({ churchId }: { churchId: string }) {
  const database = useDatabase();
  const [editor, setEditor] = useState<Editor>(null);
  const schedules = database.serviceSchedules
    .filter((item) => item.churchId === churchId)
    .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
  const exceptions = database.scheduleExceptions
    .filter((item) => item.churchId === churchId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const activeSchedule = editor?.type === "schedule" ? schedules.find((item) => item.id === editor.id) : undefined;
  const activeException = editor?.type === "exception" ? exceptions.find((item) => item.id === editor.id) : undefined;

  return (
    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <article className="panel overflow-hidden">
        <div className="panel-header">
          <div><h2 className="panel-title">Programação semanal</h2><p className="panel-description">Dias e horários recorrentes desta igreja</p></div>
          <button aria-label="Adicionar horário" className="icon-button" onClick={() => setEditor({ type: "schedule" })} title="Adicionar horário" type="button"><PlusIcon className="size-4" /></button>
        </div>
        <div className="divide-y divide-border">
          {schedules.map((schedule) => (
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5" key={schedule.id}>
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><ClockIcon className="size-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{weekdays[schedule.weekday]} · {schedule.time}</p>
                <p className="truncate text-xs text-muted">{schedule.title} · {schedule.meetingType === "rjm" ? "RJM" : "Culto"}</p>
              </div>
              <button aria-label="Editar horário" className="icon-button size-8" onClick={() => setEditor({ type: "schedule", id: schedule.id })} title="Editar" type="button"><ArrowUpRightIcon className="size-4" /></button>
            </div>
          ))}
          {schedules.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">Nenhum horário recorrente.</p>}
        </div>
      </article>

      <article className="panel overflow-hidden">
        <div className="panel-header">
          <div><h2 className="panel-title">Exceções do calendário</h2><p className="panel-description">Cancelamentos e alterações em datas específicas</p></div>
          <button className="button-secondary" onClick={() => setEditor({ type: "exception" })} type="button"><PlusIcon className="size-4" /> Nova exceção</button>
        </div>
        <div className="divide-y divide-border">
          {exceptions.map((exception) => {
            const cancelled = exception.overrides.filter((item) => item.status === "cancelled");
            const changed = exception.overrides.filter((item) => item.status === "changed");
            return (
              <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5" key={exception.id}>
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-subtle text-muted"><CalendarIcon className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold capitalize text-foreground">{formatDate(exception.date)}</p><span className="record-badge record-especial">Exceção</span></div>
                  <p className="mt-1 text-xs text-muted">{exception.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cancelled.map((item) => <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300" key={item.scheduleId}>{schedules.find((schedule) => schedule.id === item.scheduleId)?.title ?? "Evento"} cancelado</span>)}
                    {changed.map((item) => <span className="rounded-md bg-brand-soft px-2 py-1 text-[10px] font-medium text-brand" key={item.scheduleId}>{item.title || "Horário alterado"} · {item.time}</span>)}
                  </div>
                </div>
                <button aria-label="Editar exceção" className="icon-button size-8" onClick={() => setEditor({ type: "exception", id: exception.id })} title="Editar" type="button"><ArrowUpRightIcon className="size-4" /></button>
              </div>
            );
          })}
          {exceptions.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">Nenhuma exceção cadastrada.</p>}
        </div>
      </article>

      <Modal description="Define um compromisso recorrente desta igreja" onClose={() => setEditor(null)} open={editor?.type === "schedule"} title={activeSchedule ? "Editar horário" : "Adicionar horário semanal"}>
        <ScheduleForm churchId={churchId} key={activeSchedule?.updatedAt ?? "new"} onClose={() => setEditor(null)} schedule={activeSchedule} />
      </Modal>

      <Modal description="Altere somente uma data sem modificar a programação semanal" onClose={() => setEditor(null)} open={editor?.type === "exception"} size="large" title={activeException ? "Editar exceção" : "Nova exceção no calendário"}>
        <ExceptionForm churchId={churchId} exception={activeException} key={activeException?.updatedAt ?? "new"} onClose={() => setEditor(null)} schedules={schedules} />
      </Modal>
    </section>
  );
}

function ScheduleForm({ churchId, schedule, onClose }: { churchId: string; schedule?: ServiceSchedule; onClose: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    databaseStore.saveServiceSchedule({
      churchId,
      weekday: Number(form.get("weekday")),
      time: String(form.get("time")),
      meetingType: String(form.get("meetingType")) as "culto" | "rjm",
      title: String(form.get("title")).trim(),
      active: true,
    }, schedule?.id);
    onClose();
  }

  return (
    <form className="p-4 sm:p-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Dia da semana<select className="form-control" defaultValue={schedule?.weekday ?? 0} name="weekday">{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <label className="field-label">Horário<input className="form-control" defaultValue={schedule?.time ?? "19:00"} name="time" required type="time" /></label>
        <label className="field-label">Tipo<select className="form-control" defaultValue={schedule?.meetingType ?? "culto"} name="meetingType"><option value="culto">Culto</option><option value="rjm">RJM</option></select></label>
        <label className="field-label">Nome<input className="form-control" defaultValue={schedule?.title ?? "Culto oficial"} name="title" required /></label>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {schedule ? <button className="button-ghost text-red-600" onClick={() => { if (window.confirm("Excluir este horário recorrente?")) { databaseStore.removeServiceSchedule(schedule.id); onClose(); } }} type="button"><TrashIcon className="size-4" /> Excluir</button> : <span />}
        <button className="button-primary" type="submit">Salvar horário</button>
      </div>
    </form>
  );
}

type OverrideDraft = { status: "normal" | "cancelled" | "changed"; title: string; time: string };

function ExceptionForm({ churchId, schedules, exception, onClose }: { churchId: string; schedules: ServiceSchedule[]; exception?: ScheduleException; onClose: () => void }) {
  const [date, setDate] = useState(exception?.date ?? "");
  const [overrides, setOverrides] = useState<Record<string, OverrideDraft>>(() => Object.fromEntries(
    (exception?.overrides ?? []).map((item) => [item.scheduleId, { status: item.status, title: item.title ?? "", time: item.time ?? "" }]),
  ));
  const weekday = date ? new Date(`${date}T00:00:00Z`).getUTCDay() : -1;
  const schedulesForDate = useMemo(() => schedules.filter((item) => item.weekday === weekday), [schedules, weekday]);

  function changeOverride(schedule: ServiceSchedule, patch: Partial<OverrideDraft>) {
    setOverrides((current) => {
      const existing = current[schedule.id] ?? { status: "normal" as const, title: schedule.title, time: schedule.time };
      return { ...current, [schedule.id]: { ...existing, ...patch } };
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const normalized: ScheduleOverride[] = schedulesForDate.flatMap((schedule) => {
      const item = overrides[schedule.id];
      if (!item || item.status === "normal") return [];
      return [{ scheduleId: schedule.id, status: item.status, ...(item.status === "changed" ? { title: item.title, time: item.time } : {}) }];
    });
    if (normalized.length === 0) {
      window.alert("Marque ao menos um culto como cancelado ou alterado.");
      return;
    }
    databaseStore.saveScheduleException({ churchId, date, description: String(form.get("description")).trim(), overrides: normalized }, exception?.id);
    onClose();
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <label className="field-label">Data específica<input className="form-control" onChange={(event) => setDate(event.target.value)} required type="date" value={date} /></label>
        <label className="field-label">Motivo ou título<input className="form-control" defaultValue={exception?.description ?? ""} name="description" placeholder="Ex.: Santa Ceia" required /></label>
      </div>
      <div className="border-y border-border bg-surface-subtle p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Programação prevista para esta data</p>
        <div className="mt-3 space-y-3">
          {schedulesForDate.map((schedule) => {
            const item = overrides[schedule.id] ?? { status: "normal", title: schedule.title, time: schedule.time };
            return (
              <div className="rounded-xl border border-border bg-surface p-3" key={schedule.id}>
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_160px]">
                  <div><p className="text-sm font-semibold text-foreground">{schedule.time} · {schedule.title}</p><p className="mt-0.5 text-xs text-muted">{schedule.meetingType === "rjm" ? "RJM" : "Culto"}</p></div>
                  <label className="field-label">Nesta data<select className="form-control" onChange={(event) => changeOverride(schedule, { status: event.target.value as OverrideDraft["status"] })} value={item.status}><option value="normal">Manter normal</option><option value="cancelled">Cancelar</option><option value="changed">Alterar</option></select></label>
                </div>
                {item.status === "changed" && <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2"><label className="field-label">Novo nome<input className="form-control" onChange={(event) => changeOverride(schedule, { title: event.target.value })} value={item.title} /></label><label className="field-label">Novo horário<input className="form-control" onChange={(event) => changeOverride(schedule, { time: event.target.value })} type="time" value={item.time} /></label></div>}
              </div>
            );
          })}
          {date && schedulesForDate.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">Não há culto recorrente neste dia da semana.</p>}
          {!date && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">Selecione uma data para carregar a programação prevista.</p>}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-between sm:p-5">
        {exception ? <button className="button-ghost text-red-600" onClick={() => { if (window.confirm("Excluir esta exceção?")) { databaseStore.removeScheduleException(exception.id); onClose(); } }} type="button"><TrashIcon className="size-4" /> Excluir exceção</button> : <span />}
        <button className="button-primary" type="submit">Salvar exceção</button>
      </div>
    </form>
  );
}
