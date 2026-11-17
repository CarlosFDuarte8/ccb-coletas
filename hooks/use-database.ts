"use client";

import { useEffect, useSyncExternalStore } from "react";
import { databaseStore } from "@/lib/storage/database-store";

export function useDatabase(userId?: string) {
  const database = useSyncExternalStore(
    databaseStore.subscribe,
    databaseStore.getSnapshot,
    databaseStore.getServerSnapshot,
  );

  useEffect(() => {
    void databaseStore.initialize(userId).catch(() => undefined);
  }, [userId]);

  return database;
}
