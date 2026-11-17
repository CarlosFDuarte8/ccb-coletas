export const menuKeys = [
  "dashboard",
  "collections",
  "expenses",
  "agenda",
  "routes",
  "churches",
  "teams",
  "reports",
  "settings",
  "users",
] as const;

export type MenuKey = (typeof menuKeys)[number];

export const menuLabels: Record<MenuKey, string> = {
  dashboard: "Visão geral",
  collections: "Coletas",
  expenses: "Despesas",
  agenda: "Agenda",
  routes: "Rotas",
  churches: "Igrejas",
  teams: "Equipes",
  reports: "Relatórios",
  settings: "Configurações",
  users: "Usuários e acessos",
};

export const menuPaths: Record<MenuKey, string> = {
  dashboard: "/",
  collections: "/coletas",
  expenses: "/despesas",
  agenda: "/agenda",
  routes: "/rotas",
  churches: "/igrejas",
  teams: "/equipes",
  reports: "/relatorios",
  settings: "/configuracoes",
  users: "/configuracoes/usuarios",
};

export function getLandingPath(menus: readonly MenuKey[]) {
  const firstAllowed = menuKeys.find((menu) => menus.includes(menu));
  return firstAllowed ? menuPaths[firstAllowed] : "/acesso-negado";
}

export const appRoles = ["administrator", "sector_manager", "church_manager", "viewer"] as const;
export type AssignableRole = (typeof appRoles)[number];
export type AppRole = "super_admin" | AssignableRole;

export const roleLabels: Record<AppRole, string> = {
  super_admin: "Superadministrador",
  administrator: "Administrador",
  sector_manager: "Responsável pelo setor",
  church_manager: "Responsável pela igreja",
  viewer: "Somente leitura",
};
