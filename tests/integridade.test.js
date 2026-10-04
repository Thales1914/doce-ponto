const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { setup } = require('./helpers');

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { if (ctx) await ctx.teardown(); });
const admin = (method, path, body) => ctx.api(method, path, { token: ctx.token, body });
async function produto(dados = {}) {
  const res = await admin('POST', '/produtos', { nome: 'Doce', preco: 2.35, quantidade_disponivel: 20, ...dados });
  assert.equal(res.status, 201);
  return res.body;
}
async function restaurante() {
  const res = await admin('POST', '/restaurantes', { nome: 'Restaurante Teste' });
  assert.equal(res.status, 201);
  return res.body;
}
async function pedido(itens) {
  const res = await ctx.api('POST', '/pedidos', {
    body: { cliente: { nome: 'Cliente Teste', contato: 'cliente@teste.com' }, itens },
  });
  assert.equal(res.status, 201);
  return (await ctx.pool.query('SELECT * FROM pedidos WHERE numero_pedido = $1', [res.body.numero_pedido])).rows[0];
}
const mudar = (id, status) => admin('PUT', `/pedidos/${id}/status`, { status });
const saldo = async (id) => (await admin('GET', `/produtos/${id}`)).body.quantidade_disponivel;

test('JWT de administradora inexistente não permite consultar ou alterar módulos', async () => {
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: '2147483647', expiresIn: '1h' });
  for (const path of ['/produtos', '/restaurantes', '/pedidos', '/dashboard/resumo']) {
    assert.equal((await ctx.api('GET', path, { token })).status, 401);
  }
  assert.equal((await ctx.api('POST', '/produtos', { token, body: { nome: 'Invasão', preco: 1 } })).status, 401);
  assert.equal((await ctx.api('GET', '/produtos', { token: 'invalido' })).status, 401);
});

test('filtros recusam períodos invertidos, datas inexistentes, IDs e paginação fora dos limites', async () => {
  for (const path of ['/pedidos', '/estoque/movimentacoes', '/vendas-restaurantes', '/financeiro/entradas', '/financeiro/saidas', '/dashboard/resumo']) {
    assert.equal((await admin('GET', `${path}?inicio=2026-10-05&fim=2026-10-01`)).status, 400, path);
    assert.equal((await admin('GET', `${path}?inicio=0000-01-01`)).status, 400, path);
  }
  assert.equal((await admin('GET', '/produtos/2147483648')).status, 400);
  assert.equal((await admin('GET', '/pedidos?page=9999999999999999')).status, 400);
  assert.equal((await admin('GET', '/dashboard/resumo?inicio=9999-01-01')).status, 400);
});

test('pedido exige telefone ou e-mail e calcula centavos corretamente', async () => {
  const p = await produto({ preco: 0.1 });
  const body = { cliente: { nome: 'Cliente', contato: 'abcde' }, itens: [{ produto_id: p.id, quantidade: 3 }] };
  assert.equal((await ctx.api('POST', '/pedidos', { body })).status, 400);
  body.cliente.contato = '+55 (11) 99999-0000';
  const res = await ctx.api('POST', '/pedidos', { body });
  assert.equal(res.status, 201);
  assert.equal(res.body.total, 0.3);
});

test('falha no segundo item desfaz toda a confirmação, movimentos e financeiro', async () => {
  const a = await produto({ quantidade_disponivel: 5 });
  const b = await produto({ quantidade_disponivel: 0 });
  const p = await pedido([{ produto_id: a.id, quantidade: 3 }, { produto_id: b.id, quantidade: 1 }]);
  assert.equal((await mudar(p.id, 'confirmado')).status, 409);
  assert.equal(await saldo(a.id), 5);
  assert.equal((await ctx.pool.query('SELECT * FROM estoque_movimentacoes WHERE pedido_id = $1', [p.id])).rowCount, 0);
  assert.equal((await ctx.pool.query('SELECT * FROM financeiro_entradas WHERE pedido_id = $1', [p.id])).rowCount, 0);
  const detalhe = (await admin('GET', `/pedidos/${p.id}/detalhes`)).body;
  assert.equal(detalhe.status, 'solicitado');
  assert.equal(detalhe.historico.length, 1);
});

test('pedido e venda concorrentes não gastam o mesmo estoque', async () => {
  const p = await produto({ quantidade_disponivel: 5 });
  const r = await restaurante();
  const ordem = await pedido([{ produto_id: p.id, quantidade: 4 }]);
  const resultados = await Promise.all([
    mudar(ordem.id, 'confirmado'),
    admin('POST', '/vendas-restaurantes', { restaurante_id: r.id, produto_id: p.id, quantidade: 4 }),
  ]);
  assert.equal(resultados.filter((res) => [200, 201].includes(res.status)).length, 1);
  assert.equal(resultados.filter((res) => res.status === 409).length, 1);
  assert.equal(await saldo(p.id), 1);
  const movimentos = await ctx.pool.query("SELECT * FROM estoque_movimentacoes WHERE produto_id = $1 AND tipo = 'saida'", [p.id]);
  assert.equal(movimentos.rowCount, 1);
});

test('venda de produto inativo não grava venda nem movimenta estoque', async () => {
  const p = await produto({ ativo: false });
  const r = await restaurante();
  const res = await admin('POST', '/vendas-restaurantes', { restaurante_id: r.id, produto_id: p.id, quantidade: 1 });
  assert.equal(res.status, 409);
  assert.equal(res.body.erro.codigo, 'PRODUTO_INATIVO');
  assert.equal(await saldo(p.id), 20);
  assert.equal((await ctx.pool.query('SELECT * FROM vendas_restaurantes WHERE produto_id = $1', [p.id])).rowCount, 0);
});

test('totais acima do limite monetário são recusados antes de gravar pedidos ou vendas', async () => {
  const p = await produto({ preco: 9_999_999.99, quantidade_disponivel: 100_000 });
  const r = await restaurante();
  const res = await admin('POST', '/vendas-restaurantes', { restaurante_id: r.id, produto_id: p.id, quantidade: 100_000 });
  assert.equal(res.status, 400);
  const pedidoGrande = await ctx.api('POST', '/pedidos', { body: {
    cliente: { nome: 'Cliente', contato: 'limite@teste.com' },
    itens: Array.from({ length: 2 }, () => ({ produto_id: p.id, quantidade: 1000 })),
  } });
  assert.equal(pedidoGrande.status, 400);
  assert.equal(await saldo(p.id), 100_000);
  assert.equal((await ctx.pool.query('SELECT * FROM itens_pedido WHERE produto_id = $1', [p.id])).rowCount, 0);
  assert.equal((await ctx.pool.query('SELECT * FROM vendas_restaurantes WHERE produto_id = $1', [p.id])).rowCount, 0);
});

test('repetir recebimento preserva sua data original', async () => {
  const entrada = (await admin('POST', '/financeiro/entradas', {
    descricao: 'Receita anterior', valor: 10, status: 'recebido', data: '2020-01-03',
  })).body;
  const repetida = await admin('PUT', `/financeiro/entradas/${entrada.id}/status`, { status: 'recebido' });
  assert.equal(repetida.status, 200);
  assert.equal(repetida.body.data, '2020-01-03');
});

test('pagamentos concorrentes pelos dois endpoints não causam deadlock ou divergência', { timeout: 15000 }, async () => {
  const p = await produto();
  const r = await restaurante();
  const venda = (await admin('POST', '/vendas-restaurantes', {
    restaurante_id: r.id, produto_id: p.id, quantidade: 1,
  })).body;
  const resultados = await Promise.all(Array.from({ length: 12 }, (_, index) => index % 2
    ? admin('PUT', `/vendas-restaurantes/${venda.id}/pagamento`, { status_pagamento: 'recebido' })
    : admin('PUT', `/financeiro/entradas/${venda.entrada_financeira_id}/status`, { status: 'pendente' })));
  for (const res of resultados) assert.equal(res.status, 200, JSON.stringify(res.body));
  const { rows } = await ctx.pool.query(`SELECT v.status_pagamento, e.status FROM vendas_restaurantes v
    JOIN financeiro_entradas e ON e.venda_restaurante_id = v.id WHERE v.id = $1`, [venda.id]);
  assert.equal(rows[0].status_pagamento, rows[0].status);
});

test('cancelar pedido pago exige regularização financeira e não altera estoque ou histórico', async () => {
  const p = await produto();
  const ordem = await pedido([{ produto_id: p.id, quantidade: 2 }]);
  assert.equal((await mudar(ordem.id, 'confirmado')).status, 200);
  const entrada = (await ctx.pool.query('SELECT id FROM financeiro_entradas WHERE pedido_id = $1', [ordem.id])).rows[0];
  await admin('PUT', `/financeiro/entradas/${entrada.id}/status`, { status: 'recebido' });
  const res = await mudar(ordem.id, 'cancelado');
  assert.equal(res.status, 409);
  assert.equal(res.body.erro.codigo, 'PEDIDO_PAGO');
  assert.equal(await saldo(p.id), 18);
  const detalhe = (await admin('GET', `/pedidos/${ordem.id}/detalhes`)).body;
  assert.equal(detalhe.status, 'confirmado');
  assert.equal(detalhe.historico.length, 2);
  await admin('PUT', `/financeiro/entradas/${entrada.id}/status`, { status: 'pendente' });
  assert.equal((await mudar(ordem.id, 'cancelado')).status, 200);
  assert.equal(await saldo(p.id), 20);
});

test('recebimento e cancelamento simultâneos mantêm pedido e financeiro coerentes', async () => {
  const p = await produto();
  const ordem = await pedido([{ produto_id: p.id, quantidade: 2 }]);
  await mudar(ordem.id, 'confirmado');
  const entrada = (await ctx.pool.query('SELECT id FROM financeiro_entradas WHERE pedido_id = $1', [ordem.id])).rows[0];
  const results = await Promise.all([
    mudar(ordem.id, 'cancelado'),
    admin('PUT', `/financeiro/entradas/${entrada.id}/status`, { status: 'recebido' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const atual = (await ctx.pool.query(`SELECT p.status, e.status AS financeiro FROM pedidos p
    JOIN financeiro_entradas e ON e.pedido_id = p.id WHERE p.id = $1`, [ordem.id])).rows[0];
  assert.ok((atual.status === 'cancelado' && atual.financeiro === 'cancelado') ||
    (atual.status === 'confirmado' && atual.financeiro === 'recebido'));
  assert.equal(await saldo(p.id), atual.status === 'cancelado' ? 20 : 18);
});

test('entrada de estoque que ultrapassa inteiro do banco retorna erro sem alterar saldo', async () => {
  const p = await produto();
  await ctx.pool.query('UPDATE produtos SET quantidade_disponivel = 2147483647 WHERE id = $1', [p.id]);
  const res = await admin('POST', '/estoque/movimentacao', { produto_id: p.id, tipo: 'entrada', quantidade: 1 });
  assert.equal(res.status, 400);
  assert.equal(await saldo(p.id), 2147483647);
});
