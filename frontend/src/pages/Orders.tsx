import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { query, ApiError } from '../lib/api';
import { money, dateTime, statusLabels } from '../lib/format';
import { PageHeader, ErrorNotice, Loading, Empty, Pagination, StatusBadge } from '../components/UI';
import type { OrderSummary, Page } from '../types';

export default function Orders() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [validation, setValidation] = useState<unknown>(null);
  const filters = {
    cliente: params.get('cliente') || '',
    status: params.get('status') || '',
    inicio: params.get('inicio') || '',
    fim: params.get('fim') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 15,
  };
  const { data, error, loading, reload } = useResource<Page<OrderSummary>>(
    `/pedidos${query(filters)}`,
    token,
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['cliente', 'status', 'inicio', 'fim']) {
      const value = String(form.get(key) || '').trim();
      if (value) next.set(key, value);
    }
    if (next.get('inicio') && next.get('fim') && next.get('inicio')! > next.get('fim')!) {
      setValidation(new ApiError('A data inicial deve ser anterior ou igual à data final.'));
      return;
    }
    setValidation(null);
    setParams(next);
  }
  return (
    <>
      <PageHeader
        eyebrow="ACOMPANHE CADA ENCOMENDA"
        title="Pedidos"
        description="Do primeiro contato até a entrega, tudo em um só lugar."
        action={
          <button className="button button-quiet" onClick={reload}>
            <RefreshCw size={16} />
            Atualizar
          </button>
        }
      />
      <section className="panel">
        <form key={params.toString()} className="filters" onSubmit={filter}>
          <label className="filter-search">
            Cliente
            <input name="cliente" placeholder="Nome ou contato" defaultValue={filters.cliente} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status}>
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            De
            <input type="date" name="inicio" defaultValue={filters.inicio} />
          </label>
          <label>
            Até
            <input type="date" name="fim" defaultValue={filters.fim} />
          </label>
          <button className="button button-primary">Filtrar</button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setParams({});
              setValidation(null);
            }}
          >
            Limpar
          </button>
        </form>
        <ErrorNotice error={validation || error} retry={error ? reload : undefined} />
        {loading ? (
          <Loading />
        ) : (
          data &&
          (data.data.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido / cliente</th>
                      <th>Recebido em</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.numero_pedido}</strong>
                          <small>{order.cliente_nome}</small>
                        </td>
                        <td>{dateTime(order.criado_em)}</td>
                        <td>{money(order.total)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td>
                          <Link
                            className="table-link"
                            to={`/admin/pedidos/${order.id}`}
                            aria-label={`Ver pedido ${order.numero_pedido}`}
                          >
                            Ver pedido
                            <ArrowUpRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={data.meta}
                onPage={(page) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page));
                  setParams(next);
                }}
              />
            </>
          ) : (
            <Empty title="Nenhum pedido por aqui">
              Novos pedidos aparecerão aqui. Você também pode ajustar os filtros.
            </Empty>
          ))
        )}
      </section>
    </>
  );
}
