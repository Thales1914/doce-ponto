import { useState, type FormEvent } from 'react';
import { api, ApiError, query } from '../lib/api';
import { money, parsePrice } from '../lib/format';
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
import type { Expense, Income, Page } from '../types';

const dateLabel = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
const origins = { pedido: 'Pedido', venda_restaurante: 'Venda para restaurante', manual: 'Manual' };
const statuses = { recebido: 'Recebido', pendente: 'Pendente', cancelado: 'Cancelado' };

function Ledger({ type }: { type: 'entradas' | 'saidas' }) {
  const income = type === 'entradas';
  const { token } = useAuth();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const list = useResource<
    Page<Income | Expense> & {
      totais: { recebido?: number; pendente?: number; cancelado?: number; valor?: number };
    }
  >(`/financeiro/${type}` + query({ ...filters, page }), token);
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<Income | null>(null);
  const [success, setSuccess] = useState('');
  const [filterError, setFilterError] = useState<unknown>(null);
  const mutation = useMutation();
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (f.inicio && f.fim && f.inicio > f.fim) {
      setFilterError(new ApiError('A data inicial deve ser anterior ou igual à final.'));
      return;
    }
    setFilterError(null);
    setFilters(f);
    setPage(1);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    void mutation.run(async () => {
      const valor = parsePrice(String(f.get('valor')));
      const descricao = String(f.get('descricao')).trim();
      if (!descricao) throw new ApiError('Informe uma descrição.');
      if (!Number.isFinite(valor) || valor <= 0 || valor > 9999999.99)
        throw new ApiError('Informe um valor maior que zero, com até duas casas decimais.');
      await api(`/financeiro/${type}`, {
        token,
        method: 'POST',
        body: {
          descricao,
          valor,
          ...(f.get('data') && { data: f.get('data') }),
          ...(income
            ? {
                status: f.get('status'),
                ...(String(f.get('forma')).trim() && { forma: String(f.get('forma')).trim() }),
              }
            : { categoria: String(f.get('categoria')).trim() || null }),
        },
      });
      setCreating(false);
      setSuccess(income ? 'Receita manual registrada.' : 'Despesa registrada.');
      list.reload();
    });
  }
  return (
    <>
      <div className="ledger-toolbar">
        <h2>{income ? 'Receitas' : 'Despesas'}</h2>
        <button
          className="button button-primary"
          onClick={() => {
            mutation.reset();
            setSuccess('');
            setCreating(true);
          }}
        >
          {income ? 'Nova receita manual' : 'Nova despesa'}
        </button>
      </div>
      {success && <Success>{success}</Success>}
      <section className="panel">
        <form className="filters" onSubmit={filter}>
          <label>
            De
            <input name="inicio" type="date" />
          </label>
          <label>
            Até
            <input name="fim" type="date" />
          </label>
          {income ? (
            <>
              <label>
                Situação
                <select name="status">
                  <option value="">Todas</option>
                  <option value="recebido">Recebido</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </label>
              <label>
                Origem
                <select name="origem">
                  <option value="">Todas</option>
                  <option value="pedido">Pedido</option>
                  <option value="venda_restaurante">Venda para restaurante</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              Categoria
              <input name="categoria" maxLength={60} placeholder="Ex.: ingredientes" />
            </label>
          )}
          <button className="button button-primary">Filtrar</button>
        </form>
        <ErrorNotice error={filterError} />
        <ErrorNotice error={list.error} retry={list.reload} />
        {list.loading ? (
          <Loading />
        ) : (
          list.data && (
            <>
              <div className="finance-totals" aria-label="Totais dos filtros aplicados">
                {income ? (
                  <>
                    <div>
                      <span>Recebido</span>
                      <strong>{money(list.data.totais.recebido || 0)}</strong>
                    </div>
                    <div>
                      <span>Pendente</span>
                      <strong>{money(list.data.totais.pendente || 0)}</strong>
                    </div>
                    <div>
                      <span>Cancelado</span>
                      <strong>{money(list.data.totais.cancelado || 0)}</strong>
                    </div>
                  </>
                ) : (
                  <div>
                    <span>Despesas</span>
                    <strong>{money(list.data.totais.valor || 0)}</strong>
                  </div>
                )}
              </div>
              <p className="field-hint">
                Totais de todos os registros que correspondem aos filtros aplicados.
              </p>
              {list.data.data.length ? (
                <>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Descrição</th>
                          <th>Data</th>
                          <th>Valor</th>
                          <th>{income ? 'Origem / forma' : 'Categoria'}</th>
                          {income && (
                            <>
                              <th>Situação</th>
                              <th>Ações</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {list.data.data.map((row) => {
                          const entry = 'status' in row ? row : null;
                          return (
                            <tr key={row.id}>
                              <td>
                                {row.descricao ||
                                  (entry?.numero_pedido
                                    ? `Pedido ${entry.numero_pedido}`
                                    : entry?.restaurante_nome || 'Receita')}
                              </td>
                              <td>{dateLabel(row.data)}</td>
                              <td>{money(row.valor)}</td>
                              <td>
                                {entry ? (
                                  <>
                                    {origins[entry.origem]}
                                    <small className="product-description">
                                      {entry.forma || 'Forma não informada'}
                                    </small>
                                  </>
                                ) : (
                                  (row as Expense).categoria || 'Sem categoria'
                                )}
                              </td>
                              {entry && (
                                <>
                                  <td>{statuses[entry.status]}</td>
                                  <td>
                                    {entry.status !== 'cancelado' && (
                                      <button
                                        className="table-link"
                                        aria-label={`Pagamento da receita ${entry.id}`}
                                        onClick={() => {
                                          setSuccess('');
                                          setPayment(entry);
                                        }}
                                      >
                                        Pagamento
                                      </button>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination meta={list.data.meta} onPage={setPage} />
                </>
              ) : (
                <Empty title="Nenhum lançamento encontrado">
                  Cadastre um lançamento ou ajuste os filtros.
                </Empty>
              )}
            </>
          )
        )}
      </section>
      {creating && (
        <Modal
          title={income ? 'Nova receita manual' : 'Nova despesa'}
          onClose={() => setCreating(false)}
          busy={mutation.busy}
        >
          <form onSubmit={save}>
            <ErrorNotice error={mutation.error} />
            <fieldset className="form-fields" disabled={mutation.busy}>
              <label>
                Descrição
                <input name="descricao" required maxLength={255} />
              </label>
              <label>
                Valor (R$)
                <input name="valor" inputMode="decimal" required placeholder="0,00" />
              </label>
              <label>
                Data (opcional)
                <input name="data" type="date" />
              </label>
              {income ? (
                <>
                  <label>
                    Situação da receita
                    <select name="status" defaultValue="recebido">
                      <option value="recebido">Recebido</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </label>
                  <label>
                    Forma de pagamento (opcional)
                    <input name="forma" maxLength={30} />
                  </label>
                  <p className="field-hint">
                    Pedidos confirmados e vendas para restaurantes já geram receitas
                    automaticamente. Use este formulário para outras entradas.
                  </p>
                </>
              ) : (
                <label>
                  Categoria (opcional)
                  <input name="categoria" maxLength={60} />
                </label>
              )}
              <p className="field-hint">Se não informar a data, será usada a data de hoje.</p>
              <button className="button button-primary">
                {income ? 'Salvar receita' : 'Salvar despesa'}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
      {payment && payment.status !== 'cancelado' && (
        <PaymentDialog
          path={`/financeiro/entradas/${payment.id}/status`}
          field="status"
          current={payment.status}
          onClose={() => setPayment(null)}
          onSaved={() => {
            setPayment(null);
            setSuccess('Pagamento atualizado.');
            list.reload();
          }}
        />
      )}
    </>
  );
}

export default function Finance() {
  const [type, setType] = useState<'entradas' | 'saidas'>('entradas');
  return (
    <>
      <PageHeader
        eyebrow="CONTROLE INTERNO"
        title="Financeiro"
        description="Acompanhe receitas, despesas e valores recebidos ou pendentes."
      />
      <div className="ledger-tabs" aria-label="Tipo de lançamento">
        <button
          className={`button ${type === 'entradas' ? 'button-primary' : 'button-quiet'}`}
          aria-pressed={type === 'entradas'}
          onClick={() => setType('entradas')}
        >
          Receitas
        </button>
        <button
          className={`button ${type === 'saidas' ? 'button-primary' : 'button-quiet'}`}
          aria-pressed={type === 'saidas'}
          onClick={() => setType('saidas')}
        >
          Despesas
        </button>
      </div>
      <Ledger key={type} type={type} />
    </>
  );
}
