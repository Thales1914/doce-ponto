const { withTransaction } = require('../db/pool');
const AppError = require('../utils/AppError');
const config = require('../config/env');
const dashboardModel = require('../models/dashboardModel');

const STATUS = ['solicitado', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado'];
const arredondar = (v) => Math.round(v * 100) / 100;

/** Padrão: do primeiro dia do mês corrente até hoje (no fuso da aplicação). */
function periodoPadrao() {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: config.timezone });
  return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };
}

async function resumo({ inicio, fim } = {}) {
  const padrao = periodoPadrao();
  const periodo = { inicio: inicio || padrao.inicio, fim: fim || padrao.fim };
  if (periodo.inicio > periodo.fim) throw AppError.badRequest('A data inicial deve ser anterior ou igual à final.');

  // Todas as métricas representam a mesma fotografia do banco, mesmo durante vendas.
  const [pedidos, restaurantes, porDia, receb, pend, desp, estoque, porStatus] = await withTransaction(async (db) => [
    await dashboardModel.vendasPedidos(db, periodo),
    await dashboardModel.vendasRestaurantes(db, periodo),
    await dashboardModel.vendasPorDia(db, periodo),
    await dashboardModel.recebimentos(db, periodo),
    await dashboardModel.pendencias(db),
    await dashboardModel.despesas(db, periodo),
    await dashboardModel.estoqueAtual(db),
    await dashboardModel.pedidosPorStatus(db, periodo),
  ], { readOnly: true });

  const pendPor = Object.fromEntries(pend.map((p) => [p.origem, { quantidade: p.quantidade, valor: p.valor }]));
  const zero = { quantidade: 0, valor: 0 };

  return {
    periodo,
    vendas: {
      total: arredondar(pedidos.valor + restaurantes.valor),
      pedidos,
      restaurantes,
      por_dia: porDia,
    },
    recebimentos: receb,
    pendencias: {
      total: arredondar(pend.reduce((s, p) => s + p.valor, 0)),
      quantidade: pend.reduce((s, p) => s + p.quantidade, 0),
      por_origem: {
        pedidos: pendPor.pedidos || zero,
        restaurantes: pendPor.restaurantes || zero,
        manual: pendPor.manual || zero,
      },
    },
    despesas: desp,
    saldo_periodo: arredondar(receb.valor - desp.valor),
    estoque: {
      total_unidades: estoque.reduce((s, p) => s + p.quantidade_disponivel, 0),
      produtos: estoque,
    },
    pedidos_por_status: Object.fromEntries(
      STATUS.map((s) => [s, porStatus.find((r) => r.status === s)?.quantidade ?? 0]),
    ),
  };
}

module.exports = { resumo };
