"use client";

import { useEffect } from "react";

const themeScript = `
  try {
    const saved = localStorage.getItem("ccb-theme") || "system";
    const dark = saved === "dark" || (saved === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    document.documentElement.dataset.theme = saved;
  } catch (_) {}
`;

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if ((localStorage.getItem("ccb-theme") ?? "system") !== "system") return;
      document.documentElement.classList.toggle("dark", media.matches);
      document.documentElement.classList.toggle("light", !media.matches);
    };

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </>
  );
}
