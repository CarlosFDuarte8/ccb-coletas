"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { databaseStore } from "@/lib/storage/database-store";
import { useAuthenticatedUser } from "@/components/auth/user-context";

export function useDatabase(userId?: string) {
  const authenticatedUser = useAuthenticatedUser();
  const currentUserId = authenticatedUser?.id ?? userId;
  const getSnapshot = useCallback(() => databaseStore.getSnapshotForUser(currentUserId), [currentUserId]);
  const database = useSyncExternalStore(
    databaseStore.subscribe,
    getSnapshot,
    databaseStore.getServerSnapshot,
  );

  useEffect(() => {
    void databaseStore.initialize(currentUserId).catch(() => undefined);
  }, [currentUserId]);

  return database;
}
