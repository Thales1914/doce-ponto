import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { api, ApiError, query } from '../lib/api';
import { dateTime } from '../lib/format';
import { PageHeader, ErrorNotice, Loading, Empty, Success, Pagination } from '../components/UI';
import type { Product, Movement, Page } from '../types';
const labels = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };
export default function Stock() {
  const { token } = useAuth();
  const products = useResource<Product[]>('/produtos', token);
  const [filters, setFilters] = useState({
    produto_id: '',
    tipo: '',
    inicio: '',
    fim: '',
    page: 1,
  });
  const history = useResource<Page<Movement>>(
    `/estoque/movimentacoes${query({ ...filters, limit: 15 })}`,
    token,
  );
  const [productId, setProductId] = useState(''),
    [type, setType] = useState<Movement['tipo']>('entrada'),
    [quantity, setQuantity] = useState('');
  const [error, setError] = useState<unknown>(null),
    [filterError, setFilterError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState('');
  const lock = useRef(false);
  const product = products.data?.find((p) => p.id === Number(productId));
  const amount = Number(quantity);
  const balance = product
    ? type === 'ajuste'
      ? amount
      : product.quantidade_disponivel + (type === 'entrada' ? amount : -amount)
    : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const motivo = String(form.get('motivo')).trim();
    if (
      !product ||
      !quantity ||
      !Number.isInteger(amount) ||
      amount < (type === 'ajuste' ? 0 : 1) ||
      amount > 1000000 ||
      balance! < 0 ||
      (type === 'ajuste' && !motivo)
    ) {
      setError(
        new ApiError(
          'Confira o produto, a quantidade e o motivo. O saldo não pode ficar negativo.',
        ),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await api('/estoque/movimentacao', {
        method: 'POST',
        token,
        body: { produto_id: product.id, tipo: type, quantidade: amount, ...(motivo && { motivo }) },
      });
      setQuantity('');
      const reason = formElement.current?.elements.namedItem(
        'motivo',
      ) as HTMLTextAreaElement | null;
      if (reason) reason.value = '';
      setSuccess('Movimentação registrada. Saldo atualizado.');
      products.reload();
      history.reload();
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const formElement = useRef<HTMLFormElement>(null);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      produto_id: String(form.get('produto_id')),
      tipo: String(form.get('tipo')),
      inicio: String(form.get('inicio')),
      fim: String(form.get('fim')),
      page: 1,
    };
    if (next.inicio && next.fim && next.inicio > next.fim) {
      setFilterError(new ApiError('A data inicial deve ser anterior ou igual à data final.'));
      return;
    }
    setFilterError(null);
    setFilters(next);
  }
  return (
    <>
      <PageHeader
        eyebrow="CADA UNIDADE CONTA"
        title="Estoque"
        description="Registre a produção, acompanhe as saídas e confira os saldos."
      />
      {success && <Success>{success}</Success>}
      <ErrorNotice error={products.error} retry={products.reload} />
      <div className="stock-grid">
        <section className="panel">
          <h2>Registrar movimentação</h2>
          <form ref={formElement} onSubmit={submit}>
            <fieldset disabled={busy || products.loading || Boolean(products.error)}>
              <label>
                Produto
                <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione um produto</option>
                  {products.data?.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.nome}
                      {!p.ativo ? ' (inativo)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {product && (
                <div className="balance-preview">
                  <span>Saldo atual</span>
                  <strong>{product.quantidade_disponivel} unidades</strong>
                </div>
              )}
              <div className="form-grid">
                <label>
                  Tipo
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Movement['tipo'])}
                  >
                    {Object.entries(labels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {type === 'ajuste' ? 'Novo saldo' : 'Quantidade'}
                  <input
                    type="number"
                    required
                    min={type === 'ajuste' ? 0 : 1}
                    max="1000000"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Motivo {type !== 'ajuste' && <span className="optional">(opcional)</span>}
                <textarea name="motivo" required={type === 'ajuste'} maxLength={255} rows={2} />
              </label>
              {type === 'ajuste' && (
                <p className="field-hint">
                  O ajuste substitui o saldo atual pela quantidade informada.
                </p>
              )}
              {product && quantity && (
                <p className={balance! < 0 ? 'invalid-text' : 'field-hint'}>
                  Saldo após a movimentação: <strong>{balance} unidades</strong>
                </p>
              )}
            </fieldset>
            <ErrorNotice error={error} />
            <button
              className="button button-primary button-full"
              disabled={busy || !product || products.loading || Boolean(products.error)}
            >
              {busy ? 'Registrando…' : 'Registrar movimentação'}
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Saldos dos produtos</h2>
          {products.loading ? (
            <Loading />
          ) : products.data?.length ? (
            <div className="balance-list">
              {products.data.map((p) => (
                <div key={p.id}>
                  <span>
                    <strong>{p.nome}</strong>
                    <small>{p.ativo ? 'Ativo no cardápio' : 'Produto inativo'}</small>
                  </span>
                  <b className={p.quantidade_disponivel === 0 ? 'zero-stock' : ''}>
                    {p.quantidade_disponivel}
                    <small>unidades</small>
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Nenhum produto cadastrado">
              Cadastre os produtos antes de movimentar o estoque.
            </Empty>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Histórico de movimentações</h2>
        <form className="filters" onSubmit={filter}>
          <label>
            Produto
            <select name="produto_id">
              <option value="">Todos</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select name="tipo">
              <option value="">Todos</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            De
            <input name="inicio" type="date" />
          </label>
          <label>
            Até
            <input name="fim" type="date" />
          </label>
          <button className="button button-quiet">Filtrar histórico</button>
        </form>
        <ErrorNotice
          error={filterError || history.error}
          retry={history.error ? history.reload : undefined}
        />
        {history.loading ? (
          <Loading />
        ) : (
          history.data &&
          (history.data.data.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Data / produto</th>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                      <th>Saldo</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.data.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.produto_nome}</strong>
                          <small>{dateTime(m.criado_em)}</small>
                        </td>
                        <td>{labels[m.tipo]}</td>
                        <td>{m.quantidade}</td>
                        <td>
                          {m.saldo_anterior} → {m.saldo_posterior}
                        </td>
                        <td className="preserve-lines">{m.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={history.data.meta}
                onPage={(page) => setFilters({ ...filters, page })}
              />
            </>
          ) : (
            <Empty title="Nenhuma movimentação encontrada">
              As entradas, saídas e ajustes aparecerão aqui.
            </Empty>
          ))
        )}
      </section>
    </>
  );
}
