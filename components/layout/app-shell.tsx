"use client";

import { useState } from "react";
import { Footer } from "./footer";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ChurchSelectionProvider } from "@/components/churches/church-selection-provider";
import type { AppUserContext } from "@/lib/auth/types";

export function AppShell({ children, user }: Readonly<{ children: React.ReactNode; user: AppUserContext }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ChurchSelectionProvider allowedChurchIds={user.churchIds} userId={user.id}><div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        allowedMenus={user.menus}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed((value) => !value)}
        onNavigate={() => setMobileOpen(false)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="app-content">
        <Topbar onMenuOpen={() => setMobileOpen(true)} user={user} />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
    </div></ChurchSelectionProvider>
  );
}
