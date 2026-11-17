import assert from "node:assert/strict";
import { test } from "node:test";
import { readAllPages } from "../lib/supabase/pagination";

test("carrega mais de mil registros mesmo quando a API limita páginas menores", async () => {
  const source = Array.from({ length: 1257 }, (_, index) => ({ id: String(index).padStart(5, "0") }));
  const loaded = await readAllPages(async (after) => ({ data: source.filter((row) => !after || row.id > after).slice(0, 71), error: null }));
  assert.equal(loaded.length, 1257);
  assert.equal(new Set(loaded.map((row) => row.id)).size, 1257);
  assert.equal(loaded.at(-1)?.id, "01256");
});

test("erro em página intermediária impede apresentar total incompleto", async () => {
  await assert.rejects(readAllPages(async (after) => after ? { data: null, error: new Error("Página indisponível") } : { data: [{ id: "a" }], error: null }), /Página indisponível/);
});
