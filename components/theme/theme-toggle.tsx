"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";

type Theme = "light" | "dark" | "system";

const themes = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
  { value: "system", label: "Automático", icon: MonitorIcon },
] as const;

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("light", !isDark);
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("ccb-theme", theme);
  window.dispatchEvent(new Event("ccb-theme-change"));
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("ccb-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("ccb-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot(): Theme {
  return (document.documentElement.dataset.theme as Theme | undefined) ?? "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "system");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  const ActiveIcon = themes.find((item) => item.value === theme)?.icon ?? MonitorIcon;

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Alterar tema"
        className="icon-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ActiveIcon className="size-[18px]" />
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Aparência</p>
          {themes.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button
                className="theme-menu-item"
                key={item.value}
                onClick={() => {
                  applyTheme(item.value);
                  setOpen(false);
                }}
                role="menuitemradio"
                aria-checked={theme === item.value}
                type="button"
              >
                <ItemIcon className="size-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {theme === item.value && <CheckIcon className="size-4 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
