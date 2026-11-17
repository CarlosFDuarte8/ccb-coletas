import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/current-user";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
