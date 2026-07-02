export type NavigationItem = {
  label: string;
  href: string;
  icon: "home" | "package" | "calendar" | "route" | "users" | "chart" | "building";
};

export const mainNavigation: NavigationItem[] = [
  { label: "Visão geral", href: "/", icon: "home" },
  { label: "Coletas", href: "/coletas", icon: "package" },
  { label: "Agenda", href: "/agenda", icon: "calendar" },
  { label: "Rotas", href: "/rotas", icon: "route" },
];

export const managementNavigation: NavigationItem[] = [
  { label: "Igrejas", href: "/igrejas", icon: "building" },
  { label: "Equipes", href: "/equipes", icon: "users" },
  { label: "Relatórios", href: "/relatorios", icon: "chart" },
];
