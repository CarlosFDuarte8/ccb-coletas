"use client";

import { useState } from "react";
import { Footer } from "./footer";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ChurchSelectionProvider } from "@/components/churches/church-selection-provider";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ChurchSelectionProvider><div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed((value) => !value)}
        onNavigate={() => setMobileOpen(false)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="app-content">
        <Topbar onMenuOpen={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
    </div></ChurchSelectionProvider>
  );
}
