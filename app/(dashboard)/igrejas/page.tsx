"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowUpRightIcon,
  BuildingIcon,
  CalendarIcon,
  CheckCircleIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/icons";
import { ScheduleSettings } from "@/components/churches/schedule-settings";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDatabase } from "@/hooks/use-database";
import type { AppDatabase, Church, ChurchContact } from "@/lib/domain/types";
import { localDatabase } from "@/lib/storage/local-database";

const newChurchContacts: ChurchContact[] = [
  { id: "new-maintenance", name: "", role: "Responsável caixa de manutenção" },
  { id: "new-assistant", name: "", role: "Auxiliar" },
  { id: "new-cooperator", name: "", role: "Cooperador" },
  { id: "new-rjm", name: "", role: "Cooperador de jovens e menores" },
];

export default function ChurchesPage() {
  const database = useDatabase();
  const [editorChurchId, setEditorChurchId] = useState<string | "new" | null>(null);
  const [scheduleChurchId, setScheduleChurchId] = useState<string | null>(null);
  const [sectorEditorId, setSectorEditorId] = useState<string | "new" | null>(null);
  const editingChurch = editorChurchId && editorChurchId !== "new"
    ? database.churches.find((church) => church.id === editorChurchId)
    : undefined;
  const scheduleChurch = database.churches.find((church) => church.id === scheduleChurchId);
  const editingSector = sectorEditorId && sectorEditorId !== "new" ? database.sectors.find((sector) => sector.id === sectorEditorId) : undefined;

  return (
    <div className="page-container">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Organização</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Igrejas por setor</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Cada igreja mantém cadastro, responsáveis, calendário, coletas e depósitos independentes.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="button-secondary" onClick={() => setSectorEditorId("new")} type="button"><PlusIcon className="size-4" /> Novo setor</button>
          <button className="button-primary" onClick={() => setEditorChurchId("new")} type="button"><PlusIcon className="size-4" /> Nova igreja</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={BuildingIcon} label="Igrejas cadastradas" value={String(database.churches.length)} />
        <InfoCard icon={UsersIcon} label="Setores cadastrados" value={String(database.sectors.length)} />
        <InfoCard icon={CheckCircleIcon} label="Igrejas ativas" value={String(database.churches.filter((church) => church.active).length)} />
      </section>

      <div className="space-y-7">
        {database.sectors.map((sector) => {
          const churches = database.churches.filter((church) => church.sectorId === sector.id);
          return (
            <section key={sector.id}>
              <div className="mb-3 flex items-center gap-3">
                <div className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><BuildingIcon className="size-4" /></div>
                <div className="flex-1"><h2 className="text-base font-semibold text-foreground">Setor {sector.name}</h2><p className="text-xs text-muted">{churches.length} igreja{churches.length === 1 ? "" : "s"}</p></div>
                <button className="button-ghost" onClick={() => setSectorEditorId(sector.id)} type="button">Editar setor</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {churches.map((church) => {
                  const schedules = database.serviceSchedules.filter((schedule) => schedule.churchId === church.id);
                  const responsible = church.contacts.find((contact) => contact.role === "Responsável caixa de manutenção");
                  return (
                    <article className="panel overflow-hidden" key={church.id}>
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="logo-mark"><BuildingIcon className="size-5" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-semibold text-foreground">{church.name}</h3><span className="record-badge record-confirmed">Ativa</span></div>
                            <p className="mt-0.5 text-xs font-medium text-brand">Código {church.code}</p>
                          </div>
                        </div>
                        <dl className="mt-5 space-y-3 text-xs">
                          <div><dt className="text-muted">Endereço</dt><dd className="mt-0.5 line-clamp-2 font-medium text-foreground">{church.address || "Endereço ainda não informado"}</dd></div>
                          <div><dt className="text-muted">Responsável pelo caixa</dt><dd className="mt-0.5 font-medium text-foreground">{responsible?.name || "Não informado"}</dd></div>
                          <div className="flex gap-4"><div><dt className="text-muted">Programação</dt><dd className="mt-0.5 font-medium text-foreground">{schedules.length} horário{schedules.length === 1 ? "" : "s"}</dd></div><div><dt className="text-muted">Equipe</dt><dd className="mt-0.5 font-medium text-foreground">{church.contacts.filter((contact) => contact.name).length} responsável{church.contacts.filter((contact) => contact.name).length === 1 ? "" : "eis"}</dd></div></div>
                        </dl>
                      </div>
                      <div className="grid grid-cols-2 border-t border-border bg-surface-subtle">
                        <button className="flex items-center justify-center gap-2 border-r border-border px-3 py-3 text-xs font-semibold text-muted transition-colors hover:bg-brand-soft hover:text-brand" onClick={() => setScheduleChurchId(church.id)} type="button"><CalendarIcon className="size-4" /> Programação</button>
                        <button className="flex items-center justify-center gap-2 px-3 py-3 text-xs font-semibold text-muted transition-colors hover:bg-brand-soft hover:text-brand" onClick={() => setEditorChurchId(church.id)} type="button">Editar cadastro <ArrowUpRightIcon className="size-4" /></button>
                      </div>
                    </article>
                  );
                })}
                {churches.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted md:col-span-2 2xl:col-span-3">Nenhuma igreja cadastrada neste setor.</div>}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        description={editingChurch ? `${editingChurch.name} · ${editingChurch.code}` : "Cadastre a igreja dentro de um setor"}
        onClose={() => setEditorChurchId(null)}
        open={editorChurchId !== null}
        size="large"
        title={editingChurch ? "Editar cadastro da igreja" : "Nova igreja"}
      >
        {editorChurchId && (
          <ChurchForm
            church={editingChurch}
            database={database}
            key={editingChurch?.updatedAt ?? "new"}
            onSaved={() => setEditorChurchId(null)}
          />
        )}
      </Modal>

      <Modal
        description="O setor ficará disponível na organização e no cadastro de igrejas"
        onClose={() => setSectorEditorId(null)}
        open={sectorEditorId !== null}
        title={editingSector ? "Editar setor" : "Cadastrar setor"}
      >
        {sectorEditorId && <SectorForm database={database} key={editingSector?.updatedAt ?? "new"} name={editingSector?.name} onSaved={() => setSectorEditorId(null)} sectorId={editingSector?.id} />}
      </Modal>

      <Modal
        description={scheduleChurch ? `${scheduleChurch.name} · Setor ${database.sectors.find((sector) => sector.id === scheduleChurch.sectorId)?.name}` : ""}
        onClose={() => setScheduleChurchId(null)}
        open={Boolean(scheduleChurch)}
        size="large"
        title="Programação da igreja"
      >
        {scheduleChurch && <div className="p-4 sm:p-5"><ScheduleSettings churchId={scheduleChurch.id} /></div>}
      </Modal>
    </div>
  );
}

function ChurchForm({ database, church, onSaved }: { database: AppDatabase; church?: Church; onSaved: () => void }) {
  const contacts = church?.contacts ?? newChurchContacts;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      sectorId: String(form.get("sectorId") ?? ""),
      address: String(form.get("address") ?? "").trim(),
      latitude: String(form.get("latitude") ?? "").trim(),
      longitude: String(form.get("longitude") ?? "").trim(),
      contacts: contacts.map((contact) => ({ ...contact, name: String(form.get(`contact-${contact.id}`) ?? "").trim() })),
    };
    const duplicateCode = database.churches.some((item) => item.id !== church?.id && item.code.toLowerCase() === input.code.toLowerCase());
    if (!input.sectorId) {
      window.alert("Selecione um setor válido para a igreja.");
      return;
    }
    if (duplicateCode) {
      window.alert("Já existe uma igreja cadastrada com este código.");
      return;
    }
    if (church) localDatabase.updateChurch(church.id, input);
    else localDatabase.createChurch(input);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-2">
        <fieldset>
          <legend className="mb-4 text-sm font-semibold text-foreground">Identificação</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label sm:col-span-2">Nome da igreja<input className="form-control" defaultValue={church?.name} name="name" placeholder="Ex.: Incra 08" required /></label>
            <label className="field-label">Código<input className="form-control" defaultValue={church?.code} name="code" placeholder="Ex.: 24-0010" required /></label>
            <label className="field-label">Setor<SearchableSelect defaultValue={church?.sectorId ?? database.sectors[0]?.id} name="sectorId" options={database.sectors.map((sector) => ({ value: sector.id, label: sector.name, description: `${database.churches.filter((item) => item.sectorId === sector.id).length} igreja(s)` }))} placeholder="Buscar setor..." /></label>
            <label className="field-label sm:col-span-2">Descrição do endereço<textarea className="form-control min-h-24 resize-y py-2.5" defaultValue={church?.address} name="address" placeholder="Informe o endereço completo" /></label>
            <label className="field-label">Latitude<input className="form-control" defaultValue={church?.latitude} name="latitude" placeholder="Ex.: -15.000000" /></label>
            <label className="field-label">Longitude<input className="form-control" defaultValue={church?.longitude} name="longitude" placeholder="Ex.: -48.000000" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-foreground">Responsáveis</legend>
          <p className="mb-4 text-xs text-muted">Estes responsáveis ficam vinculados somente a esta igreja.</p>
          <div className="space-y-3">{contacts.map((contact) => <label className="field-label" key={contact.id}>{contact.role}<input className="form-control" defaultValue={contact.name} name={`contact-${contact.id}`} /></label>)}</div>
        </fieldset>
      </div>
      <div className="flex justify-end border-t border-border bg-surface-subtle p-4 sm:px-5"><button className="button-primary" type="submit">{church ? "Salvar alterações" : "Cadastrar igreja"}</button></div>
    </form>
  );
}

function SectorForm({ database, sectorId, name, onSaved }: { database: AppDatabase; sectorId?: string; name?: string; onSaved: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sectorName = String(form.get("name") ?? "").trim();
    const duplicate = database.sectors.some((sector) => sector.id !== sectorId && sector.name.toLocaleLowerCase("pt-BR") === sectorName.toLocaleLowerCase("pt-BR"));
    if (duplicate) {
      window.alert("Já existe um setor cadastrado com este nome.");
      return;
    }
    localDatabase.saveSector(sectorName, sectorId);
    onSaved();
  }

  return (
    <form className="p-4 sm:p-5" onSubmit={submit}>
      <label className="field-label">Nome do setor<input autoFocus className="form-control" defaultValue={name} name="name" placeholder="Ex.: Brazlândia" required /></label>
      <p className="mt-3 text-xs leading-5 text-muted">Depois de salvo, o setor aparecerá imediatamente no seletor pesquisável do cadastro de igrejas.</p>
      <div className="mt-5 flex justify-end"><button className="button-primary" type="submit">{sectorId ? "Salvar alterações" : "Cadastrar setor"}</button></div>
    </form>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof BuildingIcon; label: string; value: string }) {
  return <article className="panel flex items-center gap-3 p-4"><div className="metric-icon metric-icon-brand"><Icon className="size-5" /></div><div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p></div></article>;
}
