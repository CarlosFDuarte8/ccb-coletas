import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, test } from "node:test";
import postgres from "postgres";
import { asUser, createTestDatabase, seedAccessFixtures, users, type TestDatabase } from "./helpers/database";

let database: TestDatabase;
before(async () => { database = await createTestDatabase(); await seedAccessFixtures(database); });
after(async () => { await database?.close(); });
beforeEach(async () => { await database.exec("begin"); });
afterEach(async () => { await database.exec("rollback"); });

test("migrações criam rateio, manutenção, origem de pagamento e auditoria", async () => {
  const { rows } = await database.query("select table_name,column_name from information_schema.columns where table_schema='public' and column_name in ('breakdown','maintenance_cash_in_cents','payment_source')");
  assert.equal(rows.length, 3);
  const { rows: triggers } = await database.query("select tgname from pg_trigger where not tgisinternal and tgname like '%_capture_audit'");
  assert.equal(triggers.length, 8);
});

test("usuário acessa apenas a igreja permitida", async () => {
  await asUser(database, users.writer);
  const { rows } = await database.query("select id from public.churches");
  assert.deepEqual(rows.map((row) => row.id), ["church-a"]);
});

test("cadastro fora da administração nasce inativo e sem acesso global", async () => {
  const id = "00000000-0000-0000-0000-000000000099";
  await database.query("insert into auth.users(id,email) values ($1,'new@example.test')", [id]);
  const { rows } = await database.query("select active,role,all_churches_access,all_churches_write from public.profiles where id=$1", [id]);
  assert.deepEqual(rows[0], { active: false, role: "viewer", all_churches_access: false, all_churches_write: false });
  await asUser(database, id);
  assert.equal((await database.query("select id from public.collections")).rows.length, 0);
});

test("alterar e-mail não promove usuário automaticamente", async () => {
  await database.query("update auth.users set email=public.app_super_admin_email() where id=$1", [users.writer]);
  assert.equal((await database.query("select role from public.profiles where id=$1", [users.writer])).rows[0].role, "viewer");
});

test("usuário inativo não acessa igrejas", async () => {
  await asUser(database, users.inactive);
  assert.equal((await database.query("select id from public.churches")).rows.length, 0);
});

test("usuário não pode promover o próprio perfil", async () => {
  await asUser(database, users.writer);
  await database.query("update public.profiles set role='super_admin' where id=$1", [users.writer]);
  const { rows } = await database.query("select role from public.profiles where id=$1", [users.writer]);
  assert.equal(rows[0].role, "viewer");
});

test("acesso somente leitura impede lançar despesas", async () => {
  await asUser(database, users.viewer);
  await assert.rejects(database.exec("insert into public.expenses(id,church_id,competency,status,payment_method,description,category,amount_in_cents) values ('expense-a','church-a','2026-11','pending','pix','Teste','Outros',100)"), /row-level security/);
});

test("escrita em outra igreja é rejeitada", async () => {
  await asUser(database, users.writer);
  await assert.rejects(database.exec("insert into public.expenses(id,church_id,competency,status,payment_method,description,category,amount_in_cents) values ('expense-b','church-b','2026-11','pending','pix','Teste','Outros',100)"), /row-level security/);
});

test("permissão por setor inclui igrejas do setor e mantém isolamento", async () => {
  await database.query("delete from public.user_church_access where user_id=$1", [users.writer]);
  await database.query("insert into public.user_sector_access(user_id,sector_id,can_write) values ($1,'sector-b',true)", [users.writer]);
  await asUser(database, users.writer);
  assert.deepEqual((await database.query("select id from public.churches")).rows.map((row) => row.id), ["church-b"]);
});

test("escrita na igreja não concede acesso a módulos sem permissão", async () => {
  await database.query("delete from public.user_menu_permissions where user_id=$1 and menu='churches'", [users.writer]);
  await asUser(database, users.writer);
  await assert.rejects(database.exec("insert into public.service_schedules(id,church_id,weekday,time,meeting_type,title) values ('unauthorized-schedule','church-a',1,'19:00','culto','Não autorizado')"), /row-level security/);
});

test("alteração financeira gera auditoria com o autor", async () => {
  await asUser(database, users.writer);
  await database.exec("insert into public.expenses(id,church_id,competency,status,payment_method,description,category,amount_in_cents) values ('expense-a','church-a','2026-11','pending','pix','Teste','Outros',100)");
  await database.exec("reset role");
  const { rows } = await database.query("select user_id,action from public.audit_log where entity='expenses' and entity_id='expense-a'");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, users.writer);
  assert.equal(rows[0].action, "insert");
});

test("auditoria não pode ser lida por usuário operacional", async () => {
  await asUser(database, users.writer);
  assert.equal((await database.query("select id from public.audit_log")).rows.length, 0);
});

test("falha em uma transação desfaz os lançamentos anteriores", async () => {
  await database.exec("savepoint operation");
  await asUser(database, users.writer);
  await database.exec("insert into public.expenses(id,church_id,competency,status,payment_method,description,category,amount_in_cents) values ('expense-a','church-a','2026-11','pending','pix','Teste','Outros',100)");
  await assert.rejects(database.exec("insert into public.expenses(id,church_id,competency,status,payment_method,description,category,amount_in_cents) values ('expense-b','church-a','2026-11','pending','pix','Teste','Outros',-1)"));
  await database.exec("rollback to savepoint operation");
  assert.equal((await database.query("select id from public.expenses")).rows.length, 0);
  assert.equal((await database.query("select id from public.audit_log where entity='expenses'")).rows.length, 0);
});

function collection(id = "collection-a", reserved = 500) {
  return { id, church_id: "church-a", competency: "2026-11", date: "2026-11-01", meeting_type: "culto", collection_type: "normal", amount_in_cents: 1000,
    breakdown: { piety_in_cents: 0, maintenance_in_cents: 500, construction_in_cents: 0, missions_in_cents: 0, others_in_cents: 500 }, maintenance_cash_in_cents: reserved };
}

function expense(amount = 400) {
  return { id: "expense-cash", church_id: "church-a", competency: "2026-11", due_date: "2026-11-05", payment_date: "2026-11-05", status: "paid", payment_source: "maintenance_cash", payment_method: "cash", description: "Material", category: "Manutenção", amount_in_cents: amount };
}

function change(table: string, row: Record<string, unknown>, action = "upsert") { return { table, action, row }; }
async function apply(changes: unknown[]) { await database.query("select public.apply_database_changes($1::jsonb)", [JSON.stringify(changes)]); }
async function validateBalance() { await database.exec("set constraints all immediate; set constraints all deferred"); }

test("rateio inválido é rejeitado mesmo por chamada direta ao banco", async () => {
  await asUser(database, users.writer);
  const row = collection();
  row.breakdown.others_in_cents = 100;
  await assert.rejects(apply([change("collections", row)]), /collections_valid_breakdown/);
});

test("reserva não pode ultrapassar a parcela de manutenção", async () => {
  await asUser(database, users.writer);
  await assert.rejects(apply([change("collections", collection("collection-a", 501))]), /collections_valid_breakdown/);
});

test("programação de outra igreja não pode ser vinculada à coleta", async () => {
  await asUser(database, users.writer);
  await assert.rejects(apply([change("collections", { ...collection(), service_schedule_id: "schedule-b" })]), /programação deve pertencer/);
});

test("coleta precisa pertencer ao mês de competência", async () => {
  await asUser(database, users.writer);
  await assert.rejects(apply([change("collections", { ...collection(), date: "2026-12-01" })]), /collections_date_matches_competency/);
});

test("pagamento com saldo suficiente e depósito no mês seguinte permitem fechar", async () => {
  await asUser(database, users.writer);
  await apply([
    change("collections", collection()), change("expenses", expense()),
    change("deposits", { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", transaction_number: "ABC", amount_in_cents: 500, status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" }),
    change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed", closed_at: "2026-12-02T10:00:00Z" }),
  ]);
  await validateBalance();
  assert.equal((await database.query("select status from public.monthly_competencies")).rows[0].status, "closed");
});

test("despesa paga não pode consumir saldo que não existe", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection()), change("expenses", expense(501))]);
  await assert.rejects(validateBalance(), /saldo suficiente/);
});

test("redução de reserva já utilizada é rejeitada", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection()), change("expenses", expense())]);
  await validateBalance();
  await apply([change("collections", collection("collection-a", 300))]);
  await assert.rejects(validateBalance(), /saldo suficiente/);
});

test("pagamento anterior à formação do saldo é rejeitado", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection()), change("expenses", expense())]);
  await validateBalance();
  await apply([change("expenses", { ...expense(), payment_date: "2026-10-30" })]);
  await assert.rejects(validateBalance(), /saldo suficiente/);
});

test("saldo local de novembro paga despesa em dezembro sem nova reserva", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection()), change("expenses", { ...expense(), competency: "2026-12", due_date: "2026-12-05", payment_date: "2026-12-05" })]);
  await validateBalance();
});

test("alterar só a competência não altera a data de consumo do saldo", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection()), change("expenses", expense())]);
  await validateBalance();
  await apply([change("expenses", { ...expense(), competency: "2026-12" })]);
  await validateBalance();
});

test("conta de novembro fechada pode ser paga em dezembro aberto", async () => {
  await asUser(database, users.writer);
  await apply([
    change("expenses", { ...expense(), status: "pending", payment_date: null, payment_source: "administration_account" }),
    change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" }),
  ]);
  await validateBalance();
  await apply([change("expenses", { ...expense(), payment_date: "2026-12-05", payment_source: "administration_account" })]);
  await validateBalance();
});

test("alterar valor de despesa em competência fechada exige reabertura", async () => {
  await asUser(database, users.writer);
  await apply([change("expenses", { ...expense(), status: "pending", payment_date: null }), change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" })]);
  await validateBalance();
  await assert.rejects(apply([change("expenses", { ...expense(450), status: "pending", payment_date: null })]), /Reabra a competência/);
});

test("administrador pode estornar depósito e o original permanece no histórico", async () => {
  await asUser(database, users.admin);
  const original = { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", transaction_number: "ABC", amount_in_cents: 500, status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" };
  await apply([change("deposits", original)]);
  await apply([change("deposits", { ...original, status: "reversed", reversal_reason: "Comprovante incorreto" })]);
  const { rows } = await database.query("select status,amount_in_cents,reversal_reason,reversed_by from public.deposits");
  assert.equal(rows[0].status, "reversed");
  assert.equal(Number(rows[0].amount_in_cents), 500);
  assert.equal(rows[0].reversed_by, users.admin);
  await validateBalance();
});

test("depósito confirmado não pode ser apagado", async () => {
  await asUser(database, users.admin);
  await apply([change("deposits", { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", transaction_number: "ABC", amount_in_cents: 500, status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" })]);
  await assert.rejects(apply([change("deposits", { id: "deposit-a" }, "delete")]), /corrigidos por estorno/);
});

test("reabertura administrativa registra um motivo obrigatório", async () => {
  await asUser(database, users.admin);
  await apply([change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" })]);
  await validateBalance();
  await apply([change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "open", reopen_reason: "Corrigir a referência" })]);
  assert.equal((await database.query("select reopen_reason from public.monthly_competencies")).rows[0].reopen_reason, "Corrigir a referência");
});

test("usuário operacional não pode reabrir competência", async () => {
  await asUser(database, users.writer);
  await apply([change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" })]);
  await validateBalance();
  await assert.rejects(apply([change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "open", reopen_reason: "Corrigir referência" })]), /administrador autorizado/);
});

test("rascunho pode ser salvo sem data bancária", async () => {
  await asUser(database, users.writer);
  await apply([change("deposits", { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: null, amount_in_cents: 500, status: "draft" })]);
  await validateBalance();
  assert.equal((await database.query("select date from public.deposits")).rows[0].date, null);
});

test("depósitos confirmados exigem data, identificação e confirmação", async () => {
  await asUser(database, users.writer);
  await assert.rejects(apply([change("deposits", { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: null, amount_in_cents: 500, status: "confirmed" })]), /deposits_confirmation_details/);
});

test("comprovantes com espaços ou caixa diferente não podem ser duplicados", async () => {
  await asUser(database, users.writer);
  const row = { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", amount_in_cents: 500, transaction_number: " ABC ", status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" };
  await apply([change("deposits", row)]);
  await assert.rejects(apply([change("deposits", { ...row, id: "deposit-b", transaction_number: "abc" })]), /deposits_transaction_number_unique/);
});

test("fechamento com saldo pendente é recusado no banco", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection()), change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" })]);
  await assert.rejects(validateBalance(), /saldo pendente/);
});

test("competência fechada impede alteração de coleta", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection("collection-a", 500)), change("deposits", { id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", amount_in_cents: 500, transaction_number: "ABC", status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" }), change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" })]);
  await validateBalance();
  await assert.rejects(apply([change("collections", collection("collection-a", 0))]), /competência está fechada/);
});

test("mudança concorrente detectada impede sobrescrever o registro", async () => {
  await asUser(database, users.writer);
  await apply([change("collections", collection())]);
  const { rows } = await database.query("select updated_at::text as updated_at from public.collections");
  await apply([change("collections", { ...collection(), notes: "Outra alteração" })]);
  await assert.rejects(apply([{ ...change("collections", collection()), expected_updated_at: rows[0].updated_at }]), /alterado por outro usuário/);
});

test("RPC desfaz todas as linhas quando uma delas é inválida", async () => {
  await asUser(database, users.writer);
  await database.exec("savepoint atomic_rpc");
  await assert.rejects(apply([change("collections", collection()), change("expenses", { ...expense(), amount_in_cents: -1 })]));
  await database.exec("rollback to savepoint atomic_rpc");
  assert.equal((await database.query("select id from public.collections")).rows.length, 0);
});

test("RPC não permite usar tabelas de permissões", async () => {
  await asUser(database, users.writer);
  await assert.rejects(apply([change("profiles", { id: users.writer, role: "super_admin" })]), /Tabela não permitida/);
});

test("reenvio da mesma operação retorna a confirmação sem lançar duas vezes", async () => {
  await asUser(database, users.writer);
  const payload = JSON.stringify([{ ...change("collections", collection()), expected_updated_at: null }]);
  const id = "10000000-0000-0000-0000-000000000001";
  const first = await database.query("select public.apply_database_changes($1::jsonb,$2::uuid) as result", [payload, id]);
  const retry = await database.query("select public.apply_database_changes($1::jsonb,$2::uuid) as result", [payload, id]);
  assert.deepEqual(retry.rows[0].result, first.rows[0].result);
  assert.equal((await database.query("select id from public.collections")).rows.length, 1);
});

test("identificador de operação não pode ser reutilizado com valores diferentes", async () => {
  await asUser(database, users.writer);
  const id = "10000000-0000-0000-0000-000000000001";
  await database.query("select public.apply_database_changes($1::jsonb,$2::uuid)", [JSON.stringify([change("collections", collection())]), id]);
  await assert.rejects(database.query("select public.apply_database_changes($1::jsonb,$2::uuid)", [JSON.stringify([change("collections", { ...collection(), notes: "Dados diferentes" })]), id]), /outros dados/);
});

test("campo de autor não pode ser forjado pela RPC", async () => {
  await asUser(database, users.writer);
  await assert.rejects(apply([change("collections", { ...collection(), created_by: users.admin })]), /auditoria não podem/);
});

test("importação com substituição é atômica quando o arquivo contém erro", async () => {
  await asUser(database, users.admin);
  await database.exec("savepoint atomic_import");
  await assert.rejects(database.query("select public.import_database($1::jsonb,true)", [JSON.stringify([{ table: "sectors", rows: [{ id: "new-sector", name: "Novo setor" }] }, { table: "churches", rows: [{ id: "invalid", sector_id: "missing", name: "Inválida", code: "X" }] }])]));
  await database.exec("rollback to savepoint atomic_import");
  assert.equal((await database.query("select id from public.churches")).rows.length, 2);
  assert.equal((await database.query("select id from public.sectors where id='new-sector'")).rows.length, 0);
});

test("usuário operacional não pode chamar a importação administrativa", async () => {
  await asUser(database, users.writer);
  await assert.rejects(database.query("select public.import_database('[]'::jsonb,true)"), /exclusiva do Superadministrador/);
});

test("adicionar backup preserva registros existentes e informa contagem real", async () => {
  await asUser(database, users.admin);
  const operations = [{ table: "sectors", rows: [{ id: "sector-a", name: "Não substituir" }, { id: "new-sector", name: "Novo setor" }] }];
  const { rows } = await database.query("select public.import_database($1::jsonb,false) as result", [JSON.stringify(operations)]);
  assert.deepEqual(rows[0].result, { counts: { sectors: 1 }, skipped: 1 });
  assert.equal((await database.query("select name from public.sectors where id='sector-a'")).rows[0].name, "Setor A");
});

test("adicionar backup respeita o fechamento mesmo quando os novos valores conciliam", async () => {
  await asUser(database, users.admin);
  await apply([change("monthly_competencies", { id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" })]);
  await validateBalance();
  const operations = [
    { table: "collections", rows: [collection()] },
    { table: "deposits", rows: [{ id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", transaction_number: "ABC", amount_in_cents: 500, status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" }] },
  ];
  await assert.rejects(database.query("select public.import_database($1::jsonb,false)", [JSON.stringify(operations)]), /competência está fechada/);
});

test("restauração operacional recompõe finanças e preserva acessos aos mesmos IDs", async () => {
  await asUser(database, users.admin);
  const operations = [
    { table: "sectors", rows: [{ id: "sector-a", name: "Setor A" }] },
    { table: "churches", rows: [{ id: "church-a", sector_id: "sector-a", name: "Igreja A", code: "A" }] },
    { table: "collections", rows: [collection()] },
    { table: "expenses", rows: [expense()] },
    { table: "deposits", rows: [{ id: "deposit-a", church_id: "church-a", competency: "2026-11", date: "2026-12-02", transaction_number: "ABC", amount_in_cents: 500, status: "confirmed", confirmed_at: "2026-12-02T10:00:00Z" }] },
    { table: "monthly_competencies", rows: [{ id: "month-a", church_id: "church-a", competency: "2026-11", status: "closed" }] },
  ];
  await database.query("select public.import_database($1::jsonb,true)", [JSON.stringify(operations)]);
  await validateBalance();
  assert.equal(Number((await database.query("select maintenance_cash_in_cents from public.collections")).rows[0].maintenance_cash_in_cents), 500);
  await database.exec("reset role");
  await asUser(database, users.writer);
  assert.deepEqual((await database.query("select id from public.churches")).rows.map((row) => row.id), ["church-a"]);
});

test("duas baixas concorrentes não consomem o mesmo saldo local", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  await database.exec("rollback; begin");
  await asUser(database, users.admin);
  await apply([change("collections", collection("concurrent-collection"))]);
  await database.exec("commit");
  const clients = [0, 1].map(() => postgres(process.env.TEST_DATABASE_URL!, { max: 1, prepare: false, connect_timeout: 5, onnotice: () => undefined }));
  let ready = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("As conexões de teste não ficaram prontas.")), 6000);
    timer.unref();
    release = () => { clearTimeout(timer); resolve(); };
  });
  try {
    const results = await Promise.allSettled(clients.map((client, index) => client.begin(async (transaction) => {
      await transaction.unsafe("set local role authenticated");
      await transaction.unsafe("set local statement_timeout='8s'");
      await transaction`select set_config('request.jwt.claim.sub',${users.writer},true)`;
      ready += 1; if (ready === 2) release();
      await gate;
      await transaction`select public.apply_database_changes(${JSON.stringify([change("expenses", { ...expense(400), id: `concurrent-expense-${index}` })])}::jsonb)`;
    })));
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    const rejection = results.find((item) => item.status === "rejected") as PromiseRejectedResult;
    assert.equal(rejection.reason.code, "23514");
    const { rows } = await database.query("select sum(amount_in_cents) as spent from public.expenses where id like 'concurrent-expense-%'");
    assert.equal(Number(rows[0].spent), 400);
  } finally {
    await Promise.all(clients.map((client) => client.end()));
    await database.exec("begin");
    await asUser(database, users.admin);
    await database.exec("delete from public.expenses where id like 'concurrent-expense-%'; delete from public.collections where id='concurrent-collection'; commit");
  }
});
