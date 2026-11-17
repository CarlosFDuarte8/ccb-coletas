import type { AppRole, MenuKey } from "@/config/permissions";

export type AppUserContext = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  active: boolean;
  menus: MenuKey[];
  churchIds: string[] | null;
  writableChurchIds: string[] | null;
};

