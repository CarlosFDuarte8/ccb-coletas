import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { getLandingPath, type MenuKey } from "@/config/permissions";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const redirectPreservingSession = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) response.headers.set(header, value);
    }
    return response;
  };
  const isPublicRoute = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth");
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return redirectPreservingSession(url);
  }
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectPreservingSession(url);
  }
  if (user && !isPublicRoute && request.nextUrl.pathname !== "/acesso-negado") {
    const segment = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "";
    const requiredMenu = request.nextUrl.pathname.startsWith("/configuracoes/perfil") ? undefined : request.nextUrl.pathname.startsWith("/configuracoes/usuarios") ? "users" : ({
      "": "dashboard", coletas: "collections", despesas: "expenses", agenda: "agenda", rotas: "routes",
      igrejas: "churches", equipes: "teams", relatorios: "reports", configuracoes: "settings",
    } as Record<string, string>)[segment];
    if (requiredMenu) {
      const { data: allowed } = await supabase.rpc("has_menu", { required_menu: requiredMenu });
      if (!allowed) {
        const url = request.nextUrl.clone();
        if (request.nextUrl.pathname === "/") {
          const { data: permissions } = await supabase
            .from("user_menu_permissions")
            .select("menu")
            .eq("user_id", user.id);
          url.pathname = getLandingPath(permissions?.map((permission) => permission.menu as MenuKey) ?? []);
        } else {
          url.pathname = "/acesso-negado";
        }
        url.search = "";
        return redirectPreservingSession(url);
      }
    }
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
