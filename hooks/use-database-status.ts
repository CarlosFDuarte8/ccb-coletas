"use client";
import { useSyncExternalStore } from "react";
import { databaseStore } from "@/lib/storage/database-store";
export function useDatabaseStatus() {
  return useSyncExternalStore(databaseStore.subscribeStatus, databaseStore.getStatus, databaseStore.getServerStatus);
}
