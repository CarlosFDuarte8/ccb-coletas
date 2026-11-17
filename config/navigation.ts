import type { MenuKey } from "./permissions";

export type NavigationItem = {
  label: string;
  href: string;
  icon: "home" | "package" | "calendar" | "route" | "users" | "chart" | "building" | "receipt";
  permission: MenuKey;
};

export const mainNavigation: NavigationItem[] = [
  { label: "Visão geral", href: "/", icon: "home", permission: "dashboard" },
  { label: "Coletas", href: "/coletas", icon: "package", permission: "collections" },
  { label: "Despesas", href: "/despesas", icon: "receipt", permission: "expenses" },
  { label: "Agenda", href: "/agenda", icon: "calendar", permission: "agenda" },
  { label: "Rotas", href: "/rotas", icon: "route", permission: "routes" },
];

export const managementNavigation: NavigationItem[] = [
  { label: "Igrejas", href: "/igrejas", icon: "building", permission: "churches" },
  { label: "Equipes", href: "/equipes", icon: "users", permission: "teams" },
  { label: "Relatórios", href: "/relatorios", icon: "chart", permission: "reports" },
];
