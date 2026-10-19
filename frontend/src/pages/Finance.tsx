import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { useMutation } from '../lib/useMutation';
import { api, ApiError, query } from '../lib/api';
import { dateOnly, money, originLabels, paymentLabels, parsePrice, today } from '../lib/format';
import {
  PageHeader,
  ErrorNotice,
  Loading,
  Empty,
  Success,
  Modal,
  Pagination,
} from '../components/UI';
import {
  PaymentBadge,
  PaymentMethodField,
  ReceiveModal,
  ReopenModal,
  Stat,
} from '../components/Finance';
import type { Entry, Expense, Page } from '../types';

type EntryPage = Page<Entry> & {
  totais: { recebido: number; pendente: number; cancelado: number };
};
type ExpensePage = Page<Expense> & { totais: { valor: number } };
const categories = ['Ingredientes', 'Embalagens', 'Transporte', 'Equipamentos', 'Contas fixas'];


function readFilters(form: HTMLFormElement, keys: string[]) {
  const data = new FormData(form);
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = String(data.get(key) || '').trim();
    if (value) next.set(key, value);
  }
  return next.get('inicio') && next.get('fim') && next.get('inicio')! > next.get('fim')!
    ? null
    : next;
}
const periodError = () => new ApiError('A data inicial deve ser anterior ou igual à data final.');

export default function Finance() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'saidas' ? 'saidas' : 'entradas';
  return (
    <>
      <PageHeader
        eyebrow="O DINHEIRO DO NEGÓCIO"
        title="Financeiro"
        description="Entradas de pedidos, vendas e lançamentos manuais, e as despesas do dia a dia."
      />
      <div className="tabs" role="tablist" aria-label="Seções do financeiro">
        {(['entradas', 'saidas'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'active' : ''}
            onClick={() => setParams(value === 'saidas' ? { aba: 'saidas' } : {})}
          >
            {value === 'entradas' ? 'Entradas' : 'Saídas'}
          </button>
        ))}
      </div>
      {tab === 'entradas' ? (
        <Entries params={params} setParams={setParams} />
      ) : (
        <Expenses params={params} setParams={setParams} />
      )}
    </>
  );
}
type TabProps = {
  params: URLSearchParams;
  setParams: (next: URLSearchParams) => void;
};

function Entries({ params, setParams }: TabProps) {
  const { token } = useAuth();
  const filters = {
    status: params.get('status') || '',
    origem: params.get('origem') || '',
    inicio: params.get('inicio') || '',
    fim: params.get('fim') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 15,
  };
  const entries = useResource<EntryPage>(`/financeiro/entradas${query(filters)}`, token);
  const [validation, setValidation] = useState<unknown>(null),
    [creating, setCreating] = useState(false),
    [changing, setChanging] = useState<{ entry: Entry; to: 'recebido' | 'pendente' } | null>(null),
    [newStatus, setNewStatus] = useState<'recebido' | 'pendente'>('recebido'),
    [success, setSuccess] = useState('');
  const mutation = useMutation();
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = readFilters(event.currentTarget, ['status', 'origem', 'inicio', 'fim']);
    if (!next) return setValidation(periodError());
    setValidation(null);
    setParams(next);
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const descricao = String(form.get('descricao')).trim();
    const valor = parsePrice(String(form.get('valor')));
    const forma = String(form.get('forma')).trim();
    const data = String(form.get('data'));
    if (!descricao || !Number.isFinite(valor) || valor <= 0 || valor > 9999999.99) {
      mutation.setError(new ApiError('Informe a descrição e um valor maior que zero.'));
      return;
    }
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api('/financeiro/entradas', {
        method: 'POST',
        token,
        body: {
          descricao,
          valor,
          status: newStatus,
          ...(forma && { forma }),
          ...(data && { data }),
        },
      });
    });
    if (ok) {
      setCreating(false);
      setSuccess('Entrada lançada.');
      entries.reload();
    }
  }
  async function changeStatus(extra: { forma?: string; data?: string } = {}) {
    if (!changing) return;
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api(`/financeiro/entradas/${changing.entry.id}/status`, {
        method: 'PUT',
        token,
        body: { status: changing.to, ...extra },
      });
    });
    if (ok) {
      setSuccess(
        changing.to === 'recebido' ? 'Recebimento registrado.' : 'Entrada voltou para a receber.',
      );
      setChanging(null);
      entries.reload();
    }
  }
  const describe = (entry: Entry) =>
    entry.descricao || (entry.numero_pedido ? `Pedido ${entry.numero_pedido}` : 'Entrada');
  return (
    <>
      {success && <Success>{success}</Success>}
      {entries.data && (
        <div className="stats">
          <Stat label="Recebido" value={money(entries.data.totais.recebido)} tone="good" />
          <Stat label="A receber" value={money(entries.data.totais.pendente)} tone="alert" />
          <Stat
            label="Cancelado"
            value={money(entries.data.totais.cancelado)}
            hint="Pedidos cancelados antes do pagamento"
          />
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Entradas</h2>
          <button
            className="button button-primary"
            onClick={() => {
              mutation.setError(null);
              setNewStatus('recebido');
              setCreating(true);
            }}
          >
            <Plus size={18} />
            Nova entrada
          </button>
        </div>
        <form key={params.toString()} className="filters" onSubmit={filter}>
          <label>
            Situação
            <select name="status" defaultValue={filters.status}>
              <option value="">Todas</option>
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origem
            <select name="origem" defaultValue={filters.origem}>
              <option value="">Todas</option>
              {Object.entries(originLabels).map(([value, label]) => (
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
              setParams(new URLSearchParams());
              setValidation(null);
            }}
          >
            Limpar
          </button>
        </form>
        <ErrorNotice
          error={validation || entries.error}
          retry={entries.error ? entries.reload : undefined}
        />
        {entries.loading ? (
          <Loading />
        ) : (
          entries.data &&
          (entries.data.data.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição / origem</th>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Valor</th>
                      <th>Situação</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.data.data.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{describe(entry)}</strong>
                          <small>
                            {entry.pedido_id ? (
                              <Link
                                className="inline-link"
                                to={`/admin/pedidos/${entry.pedido_id}`}
                              >
                                {originLabels.pedido}
                              </Link>
                            ) : (
                              originLabels[entry.origem]
                            )}
                          </small>
                        </td>
                        <td>{dateOnly(entry.data)}</td>
                        <td>{entry.forma || '—'}</td>
                        <td>{money(entry.valor)}</td>
                        <td>
                          <PaymentBadge status={entry.status} />
                        </td>
                        <td>
                          {entry.status === 'pendente' && (
                            <button
                              className="table-link"
                              onClick={() => {
                                mutation.setError(null);
                                setChanging({ entry, to: 'recebido' });
                              }}
                              aria-label={`Registrar recebimento de ${describe(entry)}`}
                            >
                              Registrar recebimento
                            </button>
                          )}
                          {entry.status === 'recebido' && (
                            <button
                              className="table-link table-link-muted"
                              onClick={() => {
                                mutation.setError(null);
                                setChanging({ entry, to: 'pendente' });
                              }}
                              aria-label={`Desfazer recebimento de ${describe(entry)}`}
                            >
                              Desfazer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={entries.data.meta}
                onPage={(page) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page));
                  setParams(next);
                }}
              />
            </>
          ) : (
            <Empty title="Nenhuma entrada encontrada">
              Pedidos confirmados e vendas a restaurantes geram entradas automaticamente.
            </Empty>
          ))
        )}
      </section>
      {creating && (
        <Modal title="Nova entrada" busy={mutation.busy} onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <fieldset disabled={mutation.busy}>
              <label>
                Descrição
                <input
                  name="descricao"
                  required
                  maxLength={255}
                  placeholder="Ex.: encomenda de festa paga em dinheiro"
                />
              </label>
              <div className="form-grid">
                <label>
                  Valor (R$)
                  <input name="valor" inputMode="decimal" required placeholder="0,00" />
                </label>
                <label>
                  Situação
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'recebido' | 'pendente')}
                  >
                    <option value="recebido">{paymentLabels.recebido}</option>
                    <option value="pendente">{paymentLabels.pendente}</option>
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <PaymentMethodField />
                <label>
                  Data
                  <input name="data" type="date" defaultValue={today()} />
                </label>
              </div>
              <p className="field-hint">
                Use para valores que não vieram de um pedido do site nem de uma venda a restaurante.
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
                {mutation.busy ? 'Salvando…' : 'Lançar entrada'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {changing?.to === 'recebido' && (
        <ReceiveModal
          title="Registrar recebimento"
          description={`${describe(changing.entry)} · ${money(changing.entry.valor)}`}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setChanging(null)}
          onConfirm={(extra) => void changeStatus(extra)}
        />
      )}
      {changing?.to === 'pendente' && (
        <ReopenModal
          description={`${describe(changing.entry)} (${money(changing.entry.valor)}) deixará de contar como recebido.`}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setChanging(null)}
          onConfirm={() => void changeStatus()}
        />
      )}
    </>
  );
}

function Expenses({ params, setParams }: TabProps) {
  const { token } = useAuth();
  const filters = {
    categoria: params.get('categoria') || '',
    inicio: params.get('inicio') || '',
    fim: params.get('fim') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 15,
  };
  const expenses = useResource<ExpensePage>(`/financeiro/saidas${query(filters)}`, token);
  const [validation, setValidation] = useState<unknown>(null),
    [creating, setCreating] = useState(false),
    [success, setSuccess] = useState('');
  const mutation = useMutation();
  function withTab(next: URLSearchParams) {
    next.set('aba', 'saidas');
    setParams(next);
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = readFilters(event.currentTarget, ['categoria', 'inicio', 'fim']);
    if (!next) return setValidation(periodError());
    setValidation(null);
    withTab(next);
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const descricao = String(form.get('descricao')).trim();
    const categoria = String(form.get('categoria')).trim() || null;
    const valor = parsePrice(String(form.get('valor')));
    const data = String(form.get('data'));
    if (!descricao || !Number.isFinite(valor) || valor <= 0 || valor > 9999999.99) {
      mutation.setError(new ApiError('Informe a descrição e um valor maior que zero.'));
      return;
    }
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api('/financeiro/saidas', {
        method: 'POST',
        token,
        body: { descricao, categoria, valor, ...(data && { data }) },
      });
    });
    if (ok) {
      setCreating(false);
      setSuccess('Despesa registrada.');
      expenses.reload();
    }
  }
  return (
    <>
      {success && <Success>{success}</Success>}
      {expenses.data && (
        <div className="stats">
          <Stat
            label="Total de despesas"
            value={money(expenses.data.totais.valor)}
            hint={`${expenses.data.meta.total} lançamento${expenses.data.meta.total !== 1 ? 's' : ''} no filtro`}
          />
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Saídas</h2>
          <button
            className="button button-primary"
            onClick={() => {
              mutation.setError(null);
              setCreating(true);
            }}
          >
            <Plus size={18} />
            Nova despesa
          </button>
        </div>
        <form key={params.toString()} className="filters" onSubmit={filter}>
          <label className="filter-search">
            Categoria
            <input
              name="categoria"
              list="categorias-despesa"
              maxLength={60}
              placeholder="Todas"
              defaultValue={filters.categoria}
            />
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
              withTab(new URLSearchParams());
              setValidation(null);
            }}
          >
            Limpar
          </button>
        </form>
        <datalist id="categorias-despesa">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <ErrorNotice
          error={validation || expenses.error}
          retry={expenses.error ? expenses.reload : undefined}
        />
        {expenses.loading ? (
          <Loading />
        ) : (
          expenses.data &&
          (expenses.data.data.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Data</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.data.data.map((expense) => (
                      <tr key={expense.id}>
                        <td>
                          <strong>{expense.descricao}</strong>
                        </td>
                        <td>{expense.categoria || '—'}</td>
                        <td>{dateOnly(expense.data)}</td>
                        <td>{money(expense.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={expenses.data.meta}
                onPage={(page) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page));
                  setParams(next);
                }}
              />
            </>
          ) : (
            <Empty title="Nenhuma despesa encontrada">
              Registre compras de ingredientes, embalagens e outros gastos.
            </Empty>
          ))
        )}
      </section>
      {creating && (
        <Modal title="Nova despesa" busy={mutation.busy} onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <fieldset disabled={mutation.busy}>
              <label>
                Descrição
                <input
                  name="descricao"
                  required
                  maxLength={255}
                  placeholder="Ex.: leite condensado e chocolate"
                />
              </label>
              <div className="form-grid">
                <label>
                  Valor (R$)
                  <input name="valor" inputMode="decimal" required placeholder="0,00" />
                </label>
                <label>
                  Data
                  <input name="data" type="date" defaultValue={today()} />
                </label>
              </div>
              <label>
                Categoria <span className="optional">(opcional)</span>
                <input name="categoria" list="categorias-despesa" maxLength={60} />
              </label>
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
                {mutation.busy ? 'Salvando…' : 'Registrar despesa'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
