import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, query } from '../lib/api';
import { money, dateTime, parsePrice } from '../lib/format';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { useMutation } from '../lib/useMutation';
import {
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Success,
} from '../components/UI';
import PaymentDialog from '../components/PaymentDialog';
import type { Page, Product, Restaurant, Sale } from '../types';

export default function Sales() {
  const { token } = useAuth();
  const [filters, setFilters] = useState({
    restaurante_id: '',
    status_pagamento: '',
    inicio: '',
    fim: '',
  });
  const [page, setPage] = useState(1);
  const sales = useResource<Page<Sale>>(
    '/vendas-restaurantes' + query({ ...filters, page }),
    token,
  );
  const restaurants = useResource<Restaurant[]>('/restaurantes', token);
  const products = useResource<Product[]>('/produtos', token);
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<Sale | null>(null);
  const [success, setSuccess] = useState('');
  const [filterError, setFilterError] = useState<unknown>(null);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const mutation = useMutation();
  const product = products.data?.find((p) => p.id === Number(productId));
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const values = {
      restaurante_id: String(f.get('restaurante_id')),
      status_pagamento: String(f.get('status_pagamento')),
      inicio: String(f.get('inicio')),
      fim: String(f.get('fim')),
    };
    if (values.inicio && values.fim && values.inicio > values.fim) {
      setFilterError(new ApiError('A data inicial deve ser anterior ou igual à final.'));
      return;
    }
    setFilterError(null);
    setFilters(values);
    setPage(1);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutation.run(async () => {
      const custom = String(form.get('valor')).trim();
      const valor = custom ? parsePrice(custom) : undefined;
      if (valor !== undefined && (!Number.isFinite(valor) || valor < 0 || valor > 9999999.99))
        throw new ApiError('Informe um valor válido, com até duas casas decimais.');
      const quantidade = Number(quantity);
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100000)
        throw new ApiError('Informe uma quantidade inteira entre 1 e 100.000.');
      if (product && quantidade > product.quantidade_disponivel)
        throw new ApiError('Quantidade maior que o saldo disponível.');
      await api('/vendas-restaurantes', {
        token,
        method: 'POST',
        body: {
          restaurante_id: Number(form.get('restaurante')),
          produto_id: Number(productId),
          quantidade,
          ...(valor !== undefined && { valor_total: valor }),
        },
      });
      setCreating(false);
      setSuccess('Venda registrada. Estoque atualizado e receita pendente criada.');
      sales.reload();
      products.reload();
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="DO SEU NEGÓCIO PARA OUTROS"
        title="Vendas para restaurantes"
        description="Registre as entregas vendidas e acompanhe os pagamentos."
        action={
          <button
            className="button button-primary"
            onClick={() => {
              mutation.reset();
              setProductId('');
              setQuantity('1');
              setSuccess('');
              setCreating(true);
            }}
          >
            Nova venda
          </button>
        }
      />
      {success && <Success>{success}</Success>}
      <section className="panel">
        <form className="filters" onSubmit={filter}>
          <label>
            Restaurante
            <select name="restaurante_id">
              <option value="">Todos</option>
              {restaurants.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pagamento
            <select name="status_pagamento">
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="recebido">Recebido</option>
            </select>
          </label>
          <label>
            De
            <input type="date" name="inicio" />
          </label>
          <label>
            Até
            <input type="date" name="fim" />
          </label>
          <button className="button button-primary">Filtrar</button>
        </form>
        <ErrorNotice error={filterError} />
        <ErrorNotice error={sales.error} retry={sales.reload} />
        <ErrorNotice error={restaurants.error} retry={restaurants.reload} />
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
                      <th>Restaurante / produto</th>
                      <th>Quantidade</th>
                      <th>Total</th>
                      <th>Data</th>
                      <th>Pagamento</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.data.data.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.restaurante_nome}</strong>
                          <small className="product-description">{s.produto_nome}</small>
                        </td>
                        <td>{s.quantidade}</td>
                        <td>{money(s.valor_total)}</td>
                        <td>{dateTime(s.criado_em)}</td>
                        <td>{s.status_pagamento === 'recebido' ? 'Recebido' : 'Pendente'}</td>
                        <td>
                          <button
                            className="table-link"
                            aria-label={`Pagamento da venda ${s.id}`}
                            onClick={() => {
                              setSuccess('');
                              setPayment(s);
                            }}
                          >
                            Pagamento
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={sales.data.meta} onPage={setPage} />
            </>
          ) : (
            <Empty title="Nenhuma venda encontrada">Registre uma venda ou ajuste os filtros.</Empty>
          ))
        )}
      </section>
      {creating && (
        <Modal title="Nova venda" busy={mutation.busy} onClose={() => setCreating(false)}>
          <form onSubmit={save}>
            <ErrorNotice error={mutation.error} />
            <ErrorNotice error={products.error} retry={products.reload} />
            <ErrorNotice error={restaurants.error} retry={restaurants.reload} />
            <fieldset
              className="form-fields"
              disabled={
                mutation.busy ||
                products.loading ||
                restaurants.loading ||
                !!products.error ||
                !!restaurants.error
              }
            >
              <label>
                Restaurante comprador
                <select name="restaurante" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {restaurants.data?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </label>
              {!restaurants.loading && !restaurants.data?.length && (
                <p>
                  <Link to="/admin/restaurantes">Cadastre um restaurante para continuar.</Link>
                </p>
              )}
              <label>
                Produto vendido
                <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {products.data
                    ?.filter((p) => p.ativo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Quantidade vendida
                <input
                  type="number"
                  required
                  min={1}
                  max={100000}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              {product && (
                <p className="field-hint">
                  Disponível: {product.quantidade_disponivel} unidades. Total pelo preço do produto:{' '}
                  {money(product.preco * Number(quantity || 0))}.
                </p>
              )}
              <label>
                Valor total combinado (opcional)
                <input
                  name="valor"
                  inputMode="decimal"
                  placeholder="Deixe vazio para usar o preço do produto"
                />
              </label>
              <p className="field-hint">
                Ao registrar, a quantidade será descontada do estoque e o valor ficará pendente no
                financeiro.
              </p>
              <button className="button button-primary">Registrar venda</button>
            </fieldset>
          </form>
        </Modal>
      )}
      {payment && (
        <PaymentDialog
          path={`/vendas-restaurantes/${payment.id}/pagamento`}
          field="status_pagamento"
          current={payment.status_pagamento}
          onClose={() => setPayment(null)}
          onSaved={() => {
            setPayment(null);
            setSuccess('Pagamento atualizado e sincronizado com o financeiro.');
            sales.reload();
          }}
        />
      )}
    </>
  );
}
