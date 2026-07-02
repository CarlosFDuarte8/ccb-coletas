"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNavigation, managementNavigation, type NavigationItem } from "@/config/navigation";
import {
  CalendarIcon,
  ChartIcon,
  ChevronLeftIcon,
  CloseIcon,
  HomeIcon,
  PackageIcon,
  RouteIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";

const icons = {
  home: HomeIcon,
  package: PackageIcon,
  calendar: CalendarIcon,
  route: RouteIcon,
  users: UsersIcon,
  chart: ChartIcon,
};

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onNavigate: () => void;
  onMobileClose: () => void;
};

function NavigationGroup({ items, label, pathname, onNavigate }: { items: NavigationItem[]; label: string; pathname: string; onNavigate: () => void }) {
  return (
    <div>
      <p className="sidebar-section-label">{label}</p>
      <nav aria-label={label} className="space-y-1">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
              title={item.label}
            >
              <Icon className="size-[19px] shrink-0" />
              <span className="sidebar-text truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar({ collapsed, mobileOpen, onCollapse, onNavigate, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && <button aria-label="Fechar menu" className="sidebar-overlay" onClick={onMobileClose} type="button" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="logo-mark" aria-hidden="true"><PackageIcon className="size-5" /></div>
          <div className="sidebar-text min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">CCB Coletas</p>
            <p className="truncate text-[11px] text-muted">Gestão de operações</p>
          </div>
          <button aria-label="Fechar menu" className="icon-button -mr-1 lg:hidden" onClick={onMobileClose} type="button">
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
          <NavigationGroup items={mainNavigation} label="Operação" pathname={pathname} onNavigate={onNavigate} />
          <NavigationGroup items={managementNavigation} label="Gestão" pathname={pathname} onNavigate={onNavigate} />
        </div>

        <div className="border-t border-border p-3">
          <Link className="sidebar-link" href="/configuracoes" onClick={onNavigate} title="Configurações">
            <SettingsIcon className="size-[19px] shrink-0" />
            <span className="sidebar-text truncate">Configurações</span>
          </Link>
        </div>

        <button
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          className="sidebar-collapse-button"
          onClick={onCollapse}
          type="button"
        >
          <ChevronLeftIcon className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>
    </>
  );
}
