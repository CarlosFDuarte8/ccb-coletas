"use client";

import { useState } from "react";
import { Footer } from "./footer";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
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
    </div>
  );
}
