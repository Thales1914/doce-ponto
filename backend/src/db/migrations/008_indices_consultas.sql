-- Índices para as listagens ordenadas por data e para os totais do dashboard.

-- Histórico de estoque: listagem geral ordenada do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS estoque_movimentacoes_criado_em_idx
  ON estoque_movimentacoes (criado_em DESC, id DESC);

-- Pedidos: listagem administrativa ordenada por criação (substitui o índice simples).
CREATE INDEX IF NOT EXISTS pedidos_criado_em_id_idx ON pedidos (criado_em DESC, id DESC);
DROP INDEX IF EXISTS pedidos_criado_em_idx;

-- Dashboard: vendas de pedidos no período usam a data de criação da entrada.
CREATE INDEX IF NOT EXISTS financeiro_entradas_pedido_criado_em_idx
  ON financeiro_entradas (criado_em) WHERE pedido_id IS NOT NULL;

-- Listagens do financeiro ordenadas por data.
CREATE INDEX IF NOT EXISTS financeiro_entradas_data_id_idx ON financeiro_entradas (data DESC, id DESC);
DROP INDEX IF EXISTS financeiro_entradas_data_idx;
CREATE INDEX IF NOT EXISTS financeiro_saidas_data_id_idx ON financeiro_saidas (data DESC, id DESC);
DROP INDEX IF EXISTS financeiro_saidas_data_idx;
