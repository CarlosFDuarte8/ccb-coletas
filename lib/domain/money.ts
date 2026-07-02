export const BRL_DENOMINATIONS_IN_CENTS = [
  5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
] as const;

export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function denominationLabel(valueInCents: number) {
  return formatCurrency(valueInCents).replace(/\s/g, "\u00a0");
}
