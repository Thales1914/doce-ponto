import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { ApiError, query } from '../lib/api';
import { dateOnly, money, statusLabels } from '../lib/format';
import { PageHeader, ErrorNotice, Loading, Empty, StatusBadge } from '../components/UI';
import { Stat } from '../components/Finance';
import type { DashboardSummary, OrderStatus } from '../types';

const LOW_STOCK = 5;
const MAX_FILLED_DAYS = 92;

function fillDays(period: DashboardSummary['periodo'], days: { data: string; valor: number }[]) {
  const start = new Date(`${period.inicio}T00:00:00Z`);
  const end = new Date(`${period.fim}T00:00:00Z`);
  const span = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (span > MAX_FILLED_DAYS) return days;
  const byDay = new Map(days.map((d) => [d.data, d.valor]));
  return Array.from({ length: span }, (_, i) => {
    const data = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { data, valor: byDay.get(data) ?? 0 };
  });
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((step) => step * power >= value) ?? 10) * power;
}
const compactMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);

function SalesChart({ summary }: { summary: DashboardSummary }) {
  const days = fillDays(summary.periodo, summary.vendas.por_dia);
  const top = niceMax(Math.max(0, ...days.map((d) => d.valor)));
  const [showTable, setShowTable] = useState(false);
  if (!days.some((d) => d.valor > 0))
    return <Empty title="Sem vendas no período">As vendas confirmadas aparecerão aqui.</Empty>;
  const ticks = [top, top / 2, 0];
  return (
    <>
      <div className="chart">
        <div className="chart-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{compactMoney(tick)}</span>
          ))}
        </div>
        <div className="chart-plot">
          {ticks.map((tick) => (
            <i key={tick} className="chart-grid" style={{ bottom: `${(tick / top) * 100}%` }} />
          ))}
          <div className="chart-bars" role="list" aria-label="Vendas por dia">
            {days.map((d) => (
              <div
                key={d.data}
                role="listitem"
                tabIndex={0}
                className="chart-slot"
                aria-label={`${dateOnly(d.data)}: ${money(d.valor)}`}
                data-tip={`${dateOnly(d.data)} · ${money(d.valor)}`}
              >
                <span
                  className="chart-bar"
                  style={{ height: d.valor > 0 ? `max(2px, ${(d.valor / top) * 100}%)` : 0 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="chart-dates" aria-hidden="true">
          <span>{dateOnly(days[0].data)}</span>
          <span>{dateOnly(days[days.length - 1].data)}</span>
        </div>
      </div>
      <button className="text-button" onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Ocultar tabela' : 'Ver valores em tabela'}
      </button>
      {showTable && (
        <div className="table-scroll chart-table">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Vendas</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.valor > 0)
                .map((d) => (
                  <tr key={d.data}>
                    <td>{dateOnly(d.data)}</td>
                    <td>{money(d.valor)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Dashboard() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [validation, setValidation] = useState<unknown>(null);
  const filters = { inicio: params.get('inicio') || '', fim: params.get('fim') || '' };
  const { data, error, loading, reload } = useResource<DashboardSummary>(
    `/dashboard/resumo${query(filters)}`,
    token,
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['inicio', 'fim']) {
      const value = String(form.get(key) || '');
      if (value) next.set(key, value);
    }
    if (next.get('inicio') && next.get('fim') && next.get('inicio')! > next.get('fim')!) {
      setValidation(new ApiError('A data inicial deve ser anterior ou igual à data final.'));
      return;
    }
    setValidation(null);
    setParams(next);
  }
  const lowStock = data?.estoque.produtos
    .filter((p) => p.quantidade_disponivel <= LOW_STOCK)
    .sort((a, b) => a.quantidade_disponivel - b.quantidade_disponivel);
  return (
    <>
      <PageHeader
        eyebrow="COMO ANDA O NEGÓCIO"
        title="Visão geral"
        description={
          data
            ? `De ${dateOnly(data.periodo.inicio)} a ${dateOnly(data.periodo.fim)}.`
            : 'Vendas, recebimentos e estoque em um só lugar.'
        }
        action={
          <button className="button button-quiet" onClick={reload}>
            <RefreshCw size={16} />
            Atualizar
          </button>
        }
      />
      <form key={params.toString()} className="filters panel" onSubmit={filter}>
        <label>
          De
          <input type="date" name="inicio" defaultValue={data?.periodo.inicio || filters.inicio} />
        </label>
        <label>
          Até
          <input type="date" name="fim" defaultValue={data?.periodo.fim || filters.fim} />
        </label>
        <button className="button button-primary">Ver período</button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setParams({});
            setValidation(null);
          }}
        >
          Mês atual
        </button>
      </form>
      <ErrorNotice error={validation || error} retry={error ? reload : undefined} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats">
              <Stat
                label="Vendas no período"
                value={money(data.vendas.total)}
                hint={`${data.vendas.pedidos.quantidade} pedido${data.vendas.pedidos.quantidade !== 1 ? 's' : ''} · ${data.vendas.restaurantes.quantidade} venda${data.vendas.restaurantes.quantidade !== 1 ? 's' : ''} a restaurantes`}
              />
              <Stat
                label="Recebido"
                value={money(data.recebimentos.valor)}
                tone="good"
                hint={`${data.recebimentos.quantidade} recebimento${data.recebimentos.quantidade !== 1 ? 's' : ''}`}
              />
              <Stat
                label="Despesas"
                value={money(data.despesas.valor)}
                hint={`${data.despesas.quantidade} lançamento${data.despesas.quantidade !== 1 ? 's' : ''}`}
              />
              <Stat
                label="Saldo do período"
                value={money(data.saldo_periodo)}
                tone={data.saldo_periodo < 0 ? 'alert' : undefined}
                hint="Recebido menos despesas"
              />
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Vendas por dia</h2>
                  <span>Pedidos confirmados + vendas a restaurantes</span>
                </div>
                <SalesChart summary={data} />
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>A receber</h2>
                  <Link className="table-link" to="/admin/financeiro?status=pendente">
                    Ver no financeiro <ArrowUpRight size={15} />
                  </Link>
                </div>
                <p className="dashboard-figure">{money(data.pendencias.total)}</p>
                <p className="muted">
                  Saldo em aberto hoje, independente do período ({data.pendencias.quantidade}{' '}
                  lançamento{data.pendencias.quantidade !== 1 ? 's' : ''}).
                </p>
                <dl className="breakdown">
                  <dt>Pedidos de clientes</dt>
                  <dd>{money(data.pendencias.por_origem.pedidos.valor)}</dd>
                  <dt>Restaurantes</dt>
                  <dd>{money(data.pendencias.por_origem.restaurantes.valor)}</dd>
                  <dt>Lançamentos manuais</dt>
                  <dd>{money(data.pendencias.por_origem.manual.valor)}</dd>
                </dl>
              </section>
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <h2>Pedidos no período</h2>
                <div className="balance-list">
                  {(Object.keys(statusLabels) as OrderStatus[]).map((status) => (
                    <div key={status}>
                      <Link
                        to={`/admin/pedidos?status=${status}&inicio=${data.periodo.inicio}&fim=${data.periodo.fim}`}
                        aria-label={`Ver pedidos com status ${statusLabels[status]}`}
                      >
                        <StatusBadge status={status} />
                      </Link>
                      <b>{data.pedidos_por_status[status]}</b>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Estoque baixo</h2>
                  <span>{data.estoque.total_unidades} unidades no total</span>
                </div>
                {lowStock && lowStock.length ? (
                  <div className="balance-list">
                    {lowStock.map((p) => (
                      <div key={p.id}>
                        <span>
                          <strong>{p.nome}</strong>
                          <small>
                            {p.quantidade_disponivel === 0 ? 'Esgotado' : 'Restam poucas unidades'}
                          </small>
                        </span>
                        <b className={p.quantidade_disponivel === 0 ? 'zero-stock' : ''}>
                          {p.quantidade_disponivel}
                          <small>unidades</small>
                        </b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty title="Estoque em dia">
                    Nenhum produto ativo com {LOW_STOCK} unidades ou menos.
                  </Empty>
                )}
                <Link className="table-link" to="/admin/estoque">
                  Movimentar estoque <ArrowUpRight size={15} />
                </Link>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
