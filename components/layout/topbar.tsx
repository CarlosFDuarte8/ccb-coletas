"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  ChevronDownIcon,
  DownloadIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useChurchSelection } from "@/components/churches/church-selection-provider";
import { useDatabase } from "@/hooks/use-database";

type CurrentUser = {
  name: string;
  role: string;
  email: string;
};

const currentUser: CurrentUser = {
  name: "Carlos F. Duarte",
  role: "Administrador",
  email: "carlos.duarte@example.com",
};

function getInitials(name: string) {
  const names = name.trim().split(/\s+/).filter(Boolean);
  if (names.length === 0) return "?";
  return `${names[0][0]}${names.length > 1 ? names[names.length - 1][0] : ""}`.toUpperCase();
}

export function Topbar({ onMenuOpen }: Readonly<{ onMenuOpen: () => void }>) {
  const database = useDatabase();
  const { churchId, churches, setChurchId, competency, setCompetency } = useChurchSelection();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

  return (
    <header className="topbar">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button aria-label="Abrir menu" className="icon-button shrink-0 lg:hidden" onClick={onMenuOpen} type="button">
          <MenuIcon className="size-5" />
        </button>
        <div className="relative hidden w-full max-w-xs md:block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input aria-label="Buscar" className="search-input" placeholder="Buscar coletas, equipes..." type="search" />
          <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-sans text-[10px] text-muted xl:block">Ctrl K</kbd>
        </div>
        <div className="md:hidden"><p className="text-sm font-semibold text-foreground">Visão geral</p></div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden w-56 lg:block">
          <SearchableSelect
            key={churchId}
            onChange={(value) => { if (value) setChurchId(value); }}
            options={churches.map((church) => ({
              value: church.id,
              label: church.name,
              description: `${church.code} · ${database.sectors.find((sector) => sector.id === church.sectorId)?.name ?? "Sem setor"}`,
            }))}
            placeholder="Selecionar igreja..."
            value={churchId}
          />
        </div>
        <div className="hidden w-40 lg:block">
          <input aria-label="Competência global" className="form-control" onChange={(event) => setCompetency(event.target.value)} title="Competência" type="month" value={competency} />
        </div>
        <div className="mx-1 hidden h-6 w-px bg-border lg:block" />
        <ThemeToggle />
        <button aria-label="Notificações" className="icon-button relative" type="button">
          <BellIcon className="size-[18px]" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand ring-2 ring-surface" />
        </button>
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <div className="relative" ref={userMenuRef}>
          <button aria-expanded={userMenuOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-surface-subtle" onClick={() => setUserMenuOpen((open) => !open)} type="button">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-xs font-semibold text-white">{getInitials(currentUser.name)}</span>
            <span className="hidden max-w-28 text-left xl:block"><span className="block truncate text-xs font-medium text-foreground">{currentUser.name}</span><span className="block text-[10px] text-muted">{currentUser.role}</span></span>
            <ChevronDownIcon className={`hidden size-3.5 text-muted transition-transform xl:block ${userMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {userMenuOpen && <UserMenu onNavigate={() => setUserMenuOpen(false)} user={currentUser} />}
        </div>
      </div>
    </header>
  );
}

function UserMenu({ user, onNavigate }: { user: CurrentUser; onNavigate: () => void }) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.6rem)] z-[130] w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_18px_50px_rgb(0_0_0/0.2)]" role="menu">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-sm font-semibold text-white">{getInitials(user.name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{user.name}</p><p className="truncate text-xs text-muted">{user.email}</p></div></div>
        <span className="record-badge record-normal mt-3">{user.role}</span>
      </div>
      <div className="p-1.5">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted opacity-60" disabled title="Disponível quando o perfil estiver implementado" type="button"><UsersIcon className="size-4" /><span className="flex-1">Meu perfil</span><span className="text-[10px]">Em breve</span></button>
        <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-subtle hover:text-foreground" href="/configuracoes" onClick={onNavigate} role="menuitem"><SettingsIcon className="size-4" /> Configurações</Link>
      </div>
      <div className="border-t border-border p-1.5"><button className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-muted opacity-60" disabled title="A autenticação ainda não foi configurada" type="button"><span>Sair do sistema</span><span className="text-[10px]">Indisponível</span></button></div>
    </div>
  );
}
