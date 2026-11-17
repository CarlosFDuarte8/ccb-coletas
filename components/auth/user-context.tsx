"use client";
import { createContext, useContext } from "react";
import type { AppUserContext } from "@/lib/auth/types";

const UserContext = createContext<AppUserContext | null>(null);
export function UserProvider({ user, children }: { user: AppUserContext; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
export function useAuthenticatedUser() { return useContext(UserContext); }
