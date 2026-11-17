"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { useDatabase } from "@/hooks/use-database";
import type { Church } from "@/lib/domain/types";
import { selectedChurchStore } from "@/lib/storage/selected-church";
import { selectedCompetencyStore } from "@/lib/storage/selected-competency";
import type { AppUserContext } from "@/lib/auth/types";

type ChurchSelectionValue = {
  churchId: string;
  church?: Church;
  churches: Church[];
  setChurchId: (churchId: string) => void;
  competency: string;
  setCompetency: (competency: string) => void;
  canWrite: boolean;
  canCorrect: boolean;
  user: AppUserContext;
};

const ChurchSelectionContext = createContext<ChurchSelectionValue | null>(null);

export function ChurchSelectionProvider({ children, allowedChurchIds, userId, user }: { children: React.ReactNode; allowedChurchIds: string[] | null; userId: string; user: AppUserContext }) {
  const database = useDatabase(userId);
  const storedId = useSyncExternalStore(selectedChurchStore.subscribe, selectedChurchStore.getSnapshot, selectedChurchStore.getServerSnapshot);
  const storedCompetency = useSyncExternalStore(selectedCompetencyStore.subscribe, selectedCompetencyStore.getSnapshot, selectedCompetencyStore.getServerSnapshot);
  const churches = allowedChurchIds === null
    ? database.churches
    : database.churches.filter((item) => allowedChurchIds.includes(item.id));
  const church = churches.find((item) => item.id === storedId) ?? churches[0];
  const now = new Date();
  const defaultCompetency = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competency = /^\d{4}-\d{2}$/.test(storedCompetency) ? storedCompetency : defaultCompetency;
  const canWrite = Boolean(church && (user.writableChurchIds === null || user.writableChurchIds.includes(church.id)));
  const value = useMemo(() => ({
    churchId: church?.id ?? "",
    church,
    churches,
    setChurchId: (churchId: string) => selectedChurchStore.set(churchId),
    competency,
    setCompetency: (competency: string) => selectedCompetencyStore.set(competency),
    canWrite,
    canCorrect: canWrite && ["super_admin", "administrator", "sector_manager"].includes(user.role),
    user,
  }), [church, churches, competency, canWrite, user]);
  return <ChurchSelectionContext.Provider value={value}>{children}</ChurchSelectionContext.Provider>;
}

export function useChurchSelection() {
  const context = useContext(ChurchSelectionContext);
  if (!context) throw new Error("useChurchSelection deve ser usado dentro de ChurchSelectionProvider.");
  return context;
}
