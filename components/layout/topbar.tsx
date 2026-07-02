import { BellIcon, ChevronDownIcon, MenuIcon, SearchIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Topbar({ onMenuOpen }: Readonly<{ onMenuOpen: () => void }>) {
  return (
    <header className="topbar">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button aria-label="Abrir menu" className="icon-button lg:hidden" onClick={onMenuOpen} type="button">
          <MenuIcon className="size-5" />
        </button>
        <div className="relative hidden w-full max-w-sm md:block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input aria-label="Buscar" className="search-input" placeholder="Buscar coletas, equipes..." type="search" />
          <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-sans text-[10px] text-muted xl:block">Ctrl K</kbd>
        </div>
        <div className="md:hidden">
          <p className="text-sm font-semibold text-foreground">Visão geral</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        <button aria-label="Notificações" className="icon-button relative" type="button">
          <BellIcon className="size-[18px]" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand ring-2 ring-surface" />
        </button>
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <button className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-surface-subtle" type="button">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-xs font-semibold text-white">CS</span>
          <span className="hidden text-left xl:block">
            <span className="block text-xs font-medium text-foreground">Carlos Duarte</span>
            <span className="block text-[10px] text-muted">Administrador</span>
          </span>
          <ChevronDownIcon className="hidden size-3.5 text-muted xl:block" />
        </button>
      </div>
    </header>
  );
}
