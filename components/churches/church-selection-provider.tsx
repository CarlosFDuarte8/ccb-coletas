"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { useDatabase } from "@/hooks/use-database";
import type { Church } from "@/lib/domain/types";
import { selectedChurchStore } from "@/lib/storage/selected-church";
import { selectedCompetencyStore } from "@/lib/storage/selected-competency";

type ChurchSelectionValue = {
  churchId: string;
  church?: Church;
  churches: Church[];
  setChurchId: (churchId: string) => void;
  competency: string;
  setCompetency: (competency: string) => void;
};

const ChurchSelectionContext = createContext<ChurchSelectionValue | null>(null);

export function ChurchSelectionProvider({ children }: { children: React.ReactNode }) {
  const database = useDatabase();
  const storedId = useSyncExternalStore(selectedChurchStore.subscribe, selectedChurchStore.getSnapshot, selectedChurchStore.getServerSnapshot);
  const storedCompetency = useSyncExternalStore(selectedCompetencyStore.subscribe, selectedCompetencyStore.getSnapshot, selectedCompetencyStore.getServerSnapshot);
  const church = database.churches.find((item) => item.id === storedId) ?? database.churches[0];
  const now = new Date();
  const defaultCompetency = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competency = /^\d{4}-\d{2}$/.test(storedCompetency) ? storedCompetency : defaultCompetency;
  const value = useMemo(() => ({
    churchId: church?.id ?? "",
    church,
    churches: database.churches,
    setChurchId: (churchId: string) => selectedChurchStore.set(churchId),
    competency,
    setCompetency: (competency: string) => selectedCompetencyStore.set(competency),
  }), [church, database.churches, competency]);
  return <ChurchSelectionContext.Provider value={value}>{children}</ChurchSelectionContext.Provider>;
}

export function useChurchSelection() {
  const context = useContext(ChurchSelectionContext);
  if (!context) throw new Error("useChurchSelection deve ser usado dentro de ChurchSelectionProvider.");
  return context;
}
