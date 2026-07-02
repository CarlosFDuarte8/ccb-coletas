"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/icons";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
};

export function SearchableSelect({ options, value, defaultValue, name, placeholder = "Digite para buscar...", onChange }: SearchableSelectProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const [query, setQuery] = useState(() => selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = options.filter((option) => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  function choose(option: SearchableSelectOption) {
    if (!controlled) setInternalValue(option.value);
    setQuery(option.label);
    setOpen(false);
    onChange?.(option.value);
  }

  return (
    <div className="relative" ref={rootRef}>
      {name && <input name={name} type="hidden" value={selectedValue} />}
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        className="form-control pl-9 pr-9"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (!controlled) setInternalValue("");
          onChange?.("");
        }}
        onFocus={(event) => { setQuery(selected?.label ?? query); setOpen(true); event.currentTarget.select(); }}
        placeholder={placeholder}
        role="combobox"
        value={query}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      {open && (
        <div className="search-select-menu" id={listId} role="listbox">
          {filtered.map((option) => (
            <button aria-selected={option.value === selectedValue} className="search-select-option" key={option.value} onClick={() => choose(option)} role="option" type="button">
              <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-foreground">{option.label}</span>{option.description && <span className="mt-0.5 block truncate text-[11px] text-muted">{option.description}</span>}</span>
              {option.value === selectedValue && <CheckIcon className="size-4 shrink-0 text-brand" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-5 text-center text-xs text-muted">Nenhum resultado encontrado.</p>}
        </div>
      )}
    </div>
  );
}
