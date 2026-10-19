import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { useMutation } from '../lib/useMutation';
import { api, ApiError, query } from '../lib/api';
import { dateTime, money, paymentLabels, parsePrice } from '../lib/format';
import {
  PageHeader,
  ErrorNotice,
  Loading,
  Empty,
  Success,
  Modal,
  Pagination,
} from '../components/UI';
import { PaymentBadge, ReceiveModal, ReopenModal } from '../components/Finance';
import type { Page, Product, Restaurant, Sale } from '../types';

export default function Sales() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = {
    restaurante_id: params.get('restaurante_id') || '',
    status_pagamento: params.get('status_pagamento') || '',
    inicio: params.get('inicio') || '',
    fim: params.get('fim') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 15,
  };
  const sales = useResource<Page<Sale>>(`/vendas-restaurantes${query(filters)}`, token);
  const restaurants = useResource<Restaurant[]>('/restaurantes', token);
  const products = useResource<Product[]>('/produtos', token);
  const [validation, setValidation] = useState<unknown>(null),
    [creating, setCreating] = useState(false),
    [paying, setPaying] = useState<{ sale: Sale; to: 'recebido' | 'pendente' } | null>(null),
    [success, setSuccess] = useState('');
  const [form, setForm] = useState({ restaurante_id: '', produto_id: '', quantidade: '' });
  const mutation = useMutation();
  const activeProducts = products.data?.filter((p) => p.ativo) || [];
  const product = activeProducts.find((p) => p.id === Number(form.produto_id));
  const quantity = Number(form.quantidade);
  const suggested = product && quantity > 0 ? product.preco * quantity : null;

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['restaurante_id', 'status_pagamento', 'inicio', 'fim']) {
      const value = String(data.get(key) || '').trim();
      if (value) next.set(key, value);
    }
    if (next.get('inicio') && next.get('fim') && next.get('inicio')! > next.get('fim')!) {
      setValidation(new ApiError('A data inicial deve ser anterior ou igual à data final.'));
      return;
    }
    setValidation(null);
    setParams(next);
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawValue = String(data.get('valor_total')).trim();
    const value = rawValue ? parsePrice(rawValue) : undefined;
    if (
      !form.restaurante_id ||
      !product ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000 ||
      (value !== undefined && (!Number.isFinite(value) || value > 9999999.99))
    ) {
      mutation.setError(
        new ApiError(
          'Escolha o restaurante e o produto, e informe a quantidade e um valor válido.',
        ),
      );
      return;
    }
    if (quantity > product.quantidade_disponivel) {
      mutation.setError(
        new ApiError(
          `Estoque insuficiente: há ${product.quantidade_disponivel} unidades de ${product.nome}.`,
        ),
      );
      return;
    }
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api('/vendas-restaurantes', {
        method: 'POST',
        token,
        body: {
          restaurante_id: Number(form.restaurante_id),
          produto_id: product.id,
          quantidade: quantity,
          ...(value !== undefined && { valor_total: value }),
        },
      });
    });
    if (ok) {
      setCreating(false);
      setForm({ restaurante_id: '', produto_id: '', quantidade: '' });
      setSuccess(
        'Venda registrada. O estoque foi baixado e o valor ficou a receber no financeiro.',
      );
      sales.reload();
      products.reload();
    }
  }
  async function updatePayment(extra: { forma?: string; data?: string } = {}) {
    if (!paying) return;
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api(`/vendas-restaurantes/${paying.sale.id}/pagamento`, {
        method: 'PUT',
        token,
        body: { status_pagamento: paying.to, ...extra },
      });
    });
    if (ok) {
      setSuccess(
        paying.to === 'recebido' ? 'Pagamento registrado.' : 'A venda voltou para a receber.',
      );
      setPaying(null);
      sales.reload();
    }
  }
  function openCreate() {
    mutation.setError(null);
    setCreating(true);
  }
  return (
    <>
      <PageHeader
        eyebrow="REVENDA EM PARCERIA"
        title="Vendas a restaurantes"
        description="Registre as entregas aos parceiros e acompanhe o que já foi pago."
        action={
          <div className="heading-actions">
            <button className="button button-quiet" onClick={sales.reload}>
              <RefreshCw size={16} />
              Atualizar
            </button>
            <button className="button button-primary" onClick={openCreate}>
              <Plus size={18} />
              Nova venda
            </button>
          </div>
        }
      />
      {success && <Success>{success}</Success>}
      <ErrorNotice error={restaurants.error || products.error} />
      <section className="panel">
        <form key={params.toString()} className="filters" onSubmit={filter}>
          <label className="filter-search">
            Restaurante
            <select name="restaurante_id" defaultValue={filters.restaurante_id}>
              <option value="">Todos os restaurantes</option>
              {restaurants.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pagamento
            <select name="status_pagamento" defaultValue={filters.status_pagamento}>
              <option value="">Todos</option>
              <option value="pendente">{paymentLabels.pendente}</option>
              <option value="recebido">{paymentLabels.recebido}</option>
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
        <ErrorNotice
          error={validation || sales.error}
          retry={sales.error ? sales.reload : undefined}
        />
        {sales.loading ? (
          <Loading />
        ) : (
          sales.data &&
          (sales.data.data.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Restaurante / data</th>
                      <th>Produto</th>
                      <th>Valor</th>
                      <th>Pagamento</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.data.data.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <strong>{sale.restaurante_nome}</strong>
                          <small>{dateTime(sale.criado_em)}</small>
                        </td>
                        <td>
                          {sale.quantidade}× {sale.produto_nome}
                        </td>
                        <td>{money(sale.valor_total)}</td>
                        <td>
                          <PaymentBadge status={sale.status_pagamento} />
                        </td>
                        <td>
                          {sale.status_pagamento === 'pendente' ? (
                            <button
                              className="table-link"
                              onClick={() => {
                                mutation.setError(null);
                                setPaying({ sale, to: 'recebido' });
                              }}
                              aria-label={`Registrar pagamento da venda para ${sale.restaurante_nome}`}
                            >
                              Registrar pagamento
                            </button>
                          ) : (
                            <button
                              className="table-link table-link-muted"
                              onClick={() => {
                                mutation.setError(null);
                                setPaying({ sale, to: 'pendente' });
                              }}
                              aria-label={`Desfazer pagamento da venda para ${sale.restaurante_nome}`}
                            >
                              Desfazer pagamento
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={sales.data.meta}
                onPage={(page) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page));
                  setParams(next);
                }}
              />
            </>
          ) : (
            <Empty title="Nenhuma venda por aqui">
              As vendas a restaurantes aparecerão aqui. Você também pode ajustar os filtros.
            </Empty>
          ))
        )}
      </section>
      {creating && (
        <Modal title="Nova venda" busy={mutation.busy} onClose={() => setCreating(false)}>
          {restaurants.data && restaurants.data.length === 0 ? (
            <>
              <p>Cadastre um restaurante antes de registrar a primeira venda.</p>
              <div className="form-actions">
                <Link className="button button-primary" to="/admin/restaurantes">
                  Cadastrar restaurante
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={register}>
              <fieldset disabled={mutation.busy || restaurants.loading || products.loading}>
                <label>
                  Restaurante
                  <select
                    required
                    value={form.restaurante_id}
                    onChange={(e) => setForm({ ...form, restaurante_id: e.target.value })}
                  >
                    <option value="">Selecione um restaurante</option>
                    {restaurants.data?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Produto vendido
                  <select
                    required
                    value={form.produto_id}
                    onChange={(e) => setForm({ ...form, produto_id: e.target.value })}
                  >
                    <option value="">Selecione um produto</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.quantidade_disponivel} em estoque)
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Quantidade
                    <input
                      type="number"
                      required
                      min="1"
                      max="100000"
                      step="1"
                      value={form.quantidade}
                      onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                    />
                  </label>
                  <label>
                    Valor total (R$) <span className="optional">(opcional)</span>
                    <input
                      name="valor_total"
                      inputMode="decimal"
                      placeholder={
                        suggested !== null ? suggested.toFixed(2).replace('.', ',') : '0,00'
                      }
                    />
                  </label>
                </div>
                <p className="field-hint">
                  {suggested !== null
                    ? `Sem valor informado, será usado o preço do cardápio: ${money(suggested)}.`
                    : 'Sem valor informado, será usado o preço do cardápio × quantidade.'}{' '}
                  A venda baixa o estoque e fica a receber no financeiro.
                </p>
              </fieldset>
              <ErrorNotice error={mutation.error} />
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={mutation.busy}
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={mutation.busy}>
                  {mutation.busy ? 'Registrando…' : 'Registrar venda'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {paying?.to === 'recebido' && (
        <ReceiveModal
          title="Registrar pagamento"
          description={`${paying.sale.restaurante_nome} · ${paying.sale.quantidade}× ${paying.sale.produto_nome} · ${money(paying.sale.valor_total)}`}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setPaying(null)}
          onConfirm={(extra) => void updatePayment(extra)}
        />
      )}
      {paying?.to === 'pendente' && (
        <ReopenModal
          description={`O pagamento de ${money(paying.sale.valor_total)} de ${paying.sale.restaurante_nome} deixará de contar como recebido no financeiro.`}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setPaying(null)}
          onConfirm={() => void updatePayment()}
        />
      )}
    </>
  );
}
