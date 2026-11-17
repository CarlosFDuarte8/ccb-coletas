import type { Expense } from "@/lib/domain/types";

export const paymentSources: Array<{ value: Expense["paymentSource"]; label: string }> = [
  { value: "administration_account", label: "Administração geral do DF" },
  { value: "maintenance_cash", label: "Caixa local de manutenção preventiva" },
];

export const paymentMethods: Array<{ value: Expense["paymentMethod"]; label: string }> = [
  { value: "automatic_debit", label: "Débito automático" },
  { value: "pix", label: "Pix" },
  { value: "bank_slip", label: "Boleto" },
  { value: "transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
  { value: "not_informed", label: "Não informado" },
];

export function paymentMethodLabel(value: Expense["paymentMethod"]) {
  return paymentMethods.find((method) => method.value === value)?.label ?? "Não informado";
}

export function paymentSourceLabel(value: Expense["paymentSource"]) {
  return paymentSources.find((source) => source.value === value)?.label ?? "Conta da administração";
}
