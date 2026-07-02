"use client";

import type { FocusEvent } from "react";

type CurrencyInputProps = {
  valueInCents: number;
  onValueChange: (valueInCents: number) => void;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
};

function formatInputValue(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueInCents / 100);
}

export function CurrencyInput({ valueInCents, onValueChange, disabled, required, autoFocus }: CurrencyInputProps) {
  function moveCaretToEnd(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    window.requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
  }

  return (
    <div className="currency-field">
      <span aria-hidden="true" className="currency-prefix">R$</span>
      <input
        autoFocus={autoFocus}
        className="form-control currency-control disabled:cursor-not-allowed disabled:opacity-65"
        disabled={disabled}
        inputMode="numeric"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
          const nextValue = Number(digits || "0");
          onValueChange(Number.isSafeInteger(nextValue) ? nextValue : valueInCents);
        }}
        onFocus={moveCaretToEnd}
        required={required}
        type="text"
        value={formatInputValue(valueInCents)}
      />
    </div>
  );
}
