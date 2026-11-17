import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseStore } from "../lib/storage/local-database";
import type { AppDatabase } from "../lib/domain/types";

const fixture = (): AppDatabase => ({ version: 8, appliedSeeds: [], sectors: [], churches: [], collections: [], deposits: [], competencies: [], serviceSchedules: [], scheduleExceptions: [], expenses: [] });

test("cache só muda depois de o banco confirmar a gravação", async () => {
  let confirm!: () => void;
  const confirmation = new Promise<void>((resolve) => { confirm = resolve; });
  const store = new DatabaseStore({ fetch: async () => fixture(), subscribe: () => () => undefined, sync: async () => { await confirmation; return []; } });
  await store.refreshFromCloud();
  const save = store.saveSector("Setor A");
  assert.equal(store.getSnapshot().sectors.length, 0);
  assert.equal(store.getStatus().saving, true);
  confirm(); await save;
  assert.equal(store.getSnapshot().sectors[0].name, "Setor A");
  assert.equal(store.getStatus().saving, false);
});

test("falha é devolvida ao formulário sem alterar o cache", async () => {
  const store = new DatabaseStore({ fetch: async () => fixture(), subscribe: () => () => undefined, sync: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(store.saveSector("Setor A"), /Não foi possível confirmar/);
  assert.equal(store.getSnapshot().sectors.length, 0);
  assert.match(store.getStatus().error, /Não foi possível confirmar/);
  assert.equal(store.getStatus().saving, false);
});

test("gravações simultâneas do navegador usam a versão confirmada anterior", async () => {
  const versions: number[] = [];
  const store = new DatabaseStore({ fetch: async () => fixture(), subscribe: () => () => undefined, sync: async (previous) => { versions.push(previous.sectors.length); return []; } });
  await Promise.all([store.saveSector("Setor A"), store.saveSector("Setor B")]);
  assert.deepEqual(versions, [0, 1]);
  assert.equal(store.getSnapshot().sectors.length, 2);
});

test("uma falha não impede operações posteriores", async () => {
  let fail = true;
  const store = new DatabaseStore({ fetch: async () => fixture(), subscribe: () => () => undefined, sync: async () => { if (fail) { fail = false; throw new Error("Falha de teste"); } return []; } });
  await assert.rejects(store.saveSector("Setor A"));
  await store.saveSector("Setor B");
  assert.equal(store.getSnapshot().sectors[0].name, "Setor B");
  assert.equal(store.getStatus().error, "");
});

test("uma leitura antiga não substitui uma gravação recém-confirmada", async () => {
  let finishRead!: (value: AppDatabase) => void;
  const response = new Promise<AppDatabase>((resolve) => { finishRead = resolve; });
  const store = new DatabaseStore({ fetch: () => response, subscribe: () => () => undefined, sync: async () => [] });
  const reading = store.refreshFromCloud();
  await Promise.resolve();
  await store.saveSector("Setor novo");
  finishRead(fixture());
  await reading;
  assert.equal(store.getSnapshot().sectors[0].name, "Setor novo");
});

test("falha de rede preserva o identificador e os dados para uma repetição segura", async () => {
  const attempts: string[] = [];
  let committed = fixture();
  const store = new DatabaseStore({ fetch: async () => committed, subscribe: () => () => undefined, sync: async (_previous, next, operationId) => {
    attempts.push(operationId!);
    if (attempts.length === 1) { committed = next; throw new TypeError("fetch failed"); }
    assert.deepEqual(next, committed);
    return [];
  } });
  const input = { churchId: "church-a", competency: "2026-11", dueDate: "2026-11-05", paymentDate: "", status: "pending" as const, paymentSource: "administration_account" as const, paymentMethod: "pix" as const, description: "Conta", category: "Energia", amountInCents: 100, payee: "", documentNumber: "", notes: "" };
  await assert.rejects(store.addExpense(input));
  await store.addExpense(input);
  assert.equal(attempts[0], attempts[1]);
  assert.equal(store.getSnapshot().expenses.length, 1);
});

test("consulta recuperada restabelece a assinatura após falha inicial de conexão", async () => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  let fail = true;
  let subscriptions = 0;
  const store = new DatabaseStore({ fetch: async () => { if (fail) throw new TypeError("fetch failed"); return fixture(); }, sync: async () => [], subscribe: () => { subscriptions += 1; return () => undefined; } });
  try {
    await assert.rejects(store.initialize("user-a"));
    assert.equal(subscriptions, 0);
    fail = false;
    await store.refreshFromCloud();
    assert.equal(subscriptions, 1);
    assert.equal(store.getStatus().error, "");
  } finally { Reflect.deleteProperty(globalThis, "window"); }
});

test("dados de uma sessão não aparecem durante a troca de usuário", async () => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  const source = fixture();
  source.sectors.push({ id: "sensitive", name: "Dados do usuário anterior", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z" });
  const store = new DatabaseStore({ fetch: async () => source, sync: async () => [], subscribe: () => () => undefined });
  try {
    await store.initialize("previous-user");
    assert.equal(store.getSnapshotForUser("previous-user").sectors.length, 1);
    assert.equal(store.getSnapshotForUser("new-user").sectors.length, 0);
    store.reset();
    assert.equal(store.getSnapshot().sectors.length, 0);
  } finally { Reflect.deleteProperty(globalThis, "window"); }
});
