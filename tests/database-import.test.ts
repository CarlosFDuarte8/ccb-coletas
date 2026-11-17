import assert from "node:assert/strict";
import { test } from "node:test";
import { isDatabaseFile } from "../lib/storage/database-import";
import { seedDatabase } from "../lib/storage/seed";

test("arquivo inicial do sistema é aceito pela validação de importação", () => {
  assert.equal(isDatabaseFile(seedDatabase), true);
});

test("JSON com registros inválidos é rejeitado antes de chegar ao banco", () => {
  assert.equal(isDatabaseFile({ sectors: [null], churches: [], collections: [], deposits: [], expenses: [] }), false);
  assert.equal(isDatabaseFile({ sectors: [], churches: [], collections: [], deposits: [], expenses: [{ id: "x", churchId: "a", competency: "2026-11", description: "Conta", category: "Energia", amountInCents: "100" }] }), false);
});

test("identificadores duplicados dentro do arquivo são rejeitados", () => {
  const database = structuredClone(seedDatabase);
  database.sectors.push(database.sectors[0]);
  assert.equal(isDatabaseFile(database), false);
});
