import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { ApiError, query } from '../lib/api';
import { money, statusLabels } from '../lib/format';
import { Empty, ErrorNotice, Loading, PageHeader, StatusBadge } from '../components/UI';
import type { DashboardSummary, OrderStatus } from '../types';

const dateLabel = (date: string) => date.split('-').reverse().join('/');
function Indicator({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <article className="panel dashboard-indicator" aria-label={title}>
      <h2>{title}</h2>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
export default function Dashboard() {
  const { token } = useAuth();
  const [range, setRange] = useState({ inicio: '', fim: '' });
  const [filters, setFilters] = useState({ inicio: '', fim: '' });
  const [filterError, setError] = useState<unknown>(null);
  const { data, loading, error, reload } = useResource<DashboardSummary>(
    '/dashboard/resumo' + query(filters),
    token,
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!range.inicio || !range.fim || range.inicio > range.fim) {
      setError(new ApiError('Informe as duas datas, com a inicial anterior ou igual à final.'));
      return;
    }
    setError(null);
    setFilters({ ...range });
    if (range.inicio === filters.inicio && range.fim === filters.fim) reload();
  }
  function currentMonth() {
    setRange({ inicio: '', fim: '' });
    setFilters({ inicio: '', fim: '' });
    setError(null);
    reload();
  }
  const highest = Math.max(1, ...(data?.vendas.por_dia.map((day) => day.valor) || []));
  return (
    <>
      <PageHeader
        eyebrow="SEU NEGÓCIO EM UM OLHAR"
        title="Visão geral"
        description="Acompanhe as vendas, o dinheiro recebido e os próximos cuidados com o negócio."
        action={
          <button className="button button-quiet" disabled={loading} onClick={reload}>
            Atualizar resumo
          </button>
        }
      />
      <section className="panel">
        <form className="filters" onSubmit={submit}>
          <label>
            Data inicial
            <input
              type="date"
              value={range.inicio}
              onChange={(e) => setRange({ ...range, inicio: e.target.value })}
              required
            />
          </label>
          <label>
            Data final
            <input
              type="date"
              value={range.fim}
              onChange={(e) => setRange({ ...range, fim: e.target.value })}
              required
            />
          </label>
          <button className="button button-primary">Aplicar período</button>
          <button type="button" className="button button-quiet" onClick={currentMonth}>
            Mês atual
          </button>
        </form>
        <ErrorNotice error={filterError} />
        {data && (
          <p className="field-hint">
            Período exibido: {dateLabel(data.periodo.inicio)} a {dateLabel(data.periodo.fim)}. Datas
            no horário de Brasília.
          </p>
        )}
      </section>
      <ErrorNotice error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="dashboard-indicators">
              <Indicator
                title="Vendas no período"
                value={money(data.vendas.total)}
                note="Pedidos confirmados e vendas para restaurantes, sem pedidos cancelados."
              />
              <Indicator
                title="Recebido no período"
                value={money(data.recebimentos.valor)}
                note="Receitas recebidas, incluindo os lançamentos manuais."
              />
              <Indicator
                title="Despesas no período"
                value={money(data.despesas.valor)}
                note="Despesas registradas nas datas selecionadas."
              />
              <Indicator
                title="Saldo do período"
                value={money(data.saldo_periodo)}
                note="Recebimentos menos despesas do período."
              />
              <Indicator
                title="Pendente atualmente"
                value={money(data.pendencias.total)}
                note="Todos os valores ainda a receber, independentemente do período."
              />
              <Indicator
                title="Estoque atual"
                value={`${data.estoque.total_unidades} unidades`}
                note="Saldo dos produtos ativos neste momento."
              />
            </div>
            <div className="detail-grid dashboard-details">
              <div>
                <section className="panel">
                  <h2>Vendas por dia</h2>
                  <p className="field-hint">Somente os dias com vendas no período selecionado.</p>
                  {data.vendas.por_dia.length ? (
                    <ul className="sales-bars" aria-label="Valores vendidos por dia">
                      {data.vendas.por_dia.map((day) => (
                        <li key={day.data}>
                          <div>
                            <span>{dateLabel(day.data)}</span>
                            <strong>{money(day.valor)}</strong>
                          </div>
                          <div className="sales-bar-track" aria-hidden="true">
                            <span style={{ width: `${(day.valor / highest) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Sem vendas no período">
                      Selecione outro período ou registre suas primeiras vendas.
                    </Empty>
                  )}
                  <div className="dashboard-breakdown">
                    <p>
                      Pedidos <strong>{money(data.vendas.pedidos.valor)}</strong>
                    </p>
                    <p>
                      Restaurantes <strong>{money(data.vendas.restaurantes.valor)}</strong>
                    </p>
                  </div>
                  <Link className="table-link" to="/admin/vendas">
                    Ver vendas para restaurantes
                  </Link>
                </section>
                <section className="panel">
                  <h2>Estoque dos produtos</h2>
                  <p className="field-hint">
                    Posição atual dos produtos ativos; não depende do período selecionado.
                  </p>
                  {data.estoque.produtos.length ? (
                    <ul className="dashboard-stock">
                      {data.estoque.produtos.map((p) => (
                        <li key={p.id}>
                          <span>{p.nome}</span>
                          <strong>
                            {p.quantidade_disponivel === 0
                              ? 'Sem estoque'
                              : `${p.quantidade_disponivel} un.`}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Nenhum produto ativo">
                      Cadastre ou ative um produto para acompanhar o estoque.
                    </Empty>
                  )}
                  <Link className="table-link" to="/admin/estoque">
                    Gerenciar estoque
                  </Link>
                </section>
              </div>
              <div>
                <section className="panel">
                  <h2>Pedidos por status</h2>
                  <p className="field-hint">Situação atual dos pedidos criados no período.</p>
                  <ul className="dashboard-status">
                    {(Object.keys(statusLabels) as OrderStatus[]).map((status) => (
                      <li key={status}>
                        <StatusBadge status={status} />
                        <strong>{data.pedidos_por_status[status]}</strong>
                      </li>
                    ))}
                  </ul>
                  <Link className="table-link" to="/admin/pedidos">
                    Gerenciar pedidos
                  </Link>
                </section>
                <section className="panel">
                  <h2>Valores a receber</h2>
                  <p className="field-hint">Todas as pendências atuais, de qualquer data.</p>
                  <div className="dashboard-breakdown">
                    <p>
                      Pedidos <strong>{money(data.pendencias.por_origem.pedidos.valor)}</strong>
                    </p>
                    <p>
                      Restaurantes{' '}
                      <strong>{money(data.pendencias.por_origem.restaurantes.valor)}</strong>
                    </p>
                    <p>
                      Outras receitas{' '}
                      <strong>{money(data.pendencias.por_origem.manual.valor)}</strong>
                    </p>
                  </div>
                  <Link className="table-link" to="/admin/financeiro">
                    Abrir financeiro
                  </Link>
                </section>
              </div>
            </div>
          </>
        )
      )}
    </>
  );
}
