"use client";

import { useEffect, useSyncExternalStore } from "react";
import { localDatabase } from "@/lib/storage/local-database";

export function useDatabase() {
  const database = useSyncExternalStore(
    localDatabase.subscribe,
    localDatabase.getSnapshot,
    localDatabase.getServerSnapshot,
  );

  useEffect(() => {
    localDatabase.initialize();
  }, []);

  return database;
}
