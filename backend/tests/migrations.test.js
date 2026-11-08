const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { setup } = require('./helpers');

let ctx;
let adminAnterior;
before(async () => {
  ctx = await setup({ beforeMigrate: async (pool) => {
    // Reproduz um banco da fase 2 com a administradora já cadastrada.
    await pool.query(fs.readFileSync(path.join(__dirname, '../src/db/migrations/004_autenticacao.sql'), 'utf8'));
    await pool.query('CREATE TABLE schema_migrations (nome VARCHAR(255) PRIMARY KEY, aplicada_em TIMESTAMPTZ DEFAULT now())');
    await pool.query("INSERT INTO schema_migrations (nome) VALUES ('004_autenticacao.sql')");
    adminAnterior = (await pool.query(`INSERT INTO usuarios_admin (nome, email, senha_hash)
      VALUES ($1, $2, $3) RETURNING *`, [process.env.ADMIN_NOME, process.env.ADMIN_EMAIL,
      await bcrypt.hash(process.env.ADMIN_SENHA, 10)])).rows[0];
  } });
});
after(async () => { if (ctx) await ctx.teardown(); });

test('atualizar banco da fase 2 mantém cadastro, hash e login existentes', async () => {
  assert.deepEqual((await ctx.pool.query('SELECT * FROM usuarios_admin')).rows, [adminAnterior]);
  assert.equal((await ctx.api('GET', '/auth/me', { token: ctx.token })).status, 200);
  assert.equal((await ctx.api('GET', '/dashboard/resumo', { token: ctx.token })).status, 200);
});

test('migrations sobre estrutura legada preservam dados, estoque e financeiro', async () => {
  const auth = { token: ctx.token };
  const produto = (await ctx.api('POST', '/produtos', { ...auth,
    body: { nome: 'Produto existente', preco: 2.75, quantidade_disponivel: 40 } })).body;
  const restaurante = (await ctx.api('POST', '/restaurantes', { ...auth, body: { nome: 'Parceiro existente' } })).body;
  assert.equal((await ctx.api('POST', '/vendas-restaurantes', { ...auth,
    body: { restaurante_id: restaurante.id, produto_id: produto.id, quantidade: 4 } })).status, 201);
  const tabelas = ['usuarios_admin', 'produtos', 'restaurantes', 'vendas_restaurantes', 'estoque_movimentacoes', 'financeiro_entradas'];
  const snapshot = async () => {
    const result = {};
    for (const tabela of tabelas) result[tabela] = (await ctx.pool.query(`SELECT * FROM ${tabela} ORDER BY id`)).rows;
    return result;
  };
  const antes = await snapshot();
  // As migrations antigas tinham esses mesmos objetos e nomes distintos no controle.
  await ctx.pool.query("DELETE FROM schema_migrations WHERE nome <> '004_autenticacao.sql'");
  await ctx.pool.query(`INSERT INTO schema_migrations (nome) VALUES
    ('001_base.sql'), ('002_pedidos.sql'), ('003_restaurantes_financeiro.sql')`);
  const { migrate } = require('../src/db/migrate');
  await Promise.all([migrate({ silent: true }), migrate({ silent: true })]);
  assert.deepEqual(await snapshot(), antes);
  assert.equal((await ctx.pool.query('SELECT nome FROM schema_migrations')).rowCount, 7);
});
