import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { api } from '../lib/api';
import { money, dateTime, statusLabels, transitions } from '../lib/format';
import { PageHeader, ErrorNotice, Loading, StatusBadge, Success, Modal } from '../components/UI';
import type { OrderDetail as Order, OrderStatus } from '../types';

export default function OrderDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const {
    data: order,
    error,
    loading,
    reload,
  } = useResource<Order>(`/pedidos/${encodeURIComponent(id || '')}/detalhes`, token);
  const [mutationError, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState('');
  const [pending, setPending] = useState<{ status: OrderStatus; observacao: string } | null>(null);
  const lock = useRef(false);
  async function update(body: { status: OrderStatus; observacao: string }) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await api(`/pedidos/${id}/status`, { method: 'PUT', token, body });
      setPending(null);
      setSuccess('Status do pedido atualizado.');
      reload();
    } catch (err) {
      setError(err);
      setPending(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      status: String(form.get('status')) as OrderStatus,
      observacao: String(form.get('observacao')).trim(),
    };
    if (body.status === 'cancelado') setPending(body);
    else void update(body);
  }
  return (
    <>
      <Link className="back-link" to="/admin/pedidos">
        <ArrowLeft size={16} />
        Todos os pedidos
      </Link>
      <ErrorNotice error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        order && (
          <>
            <PageHeader
              eyebrow="DETALHES DA ENCOMENDA"
              title={order.numero_pedido}
              description={`Recebido em ${dateTime(order.criado_em)}`}
              action={<StatusBadge status={order.status} />}
            />
            {success && <Success>{success}</Success>}
            <ErrorNotice error={mutationError} />
            <div className="detail-grid">
              <div>
                <section className="panel">
                  <h2>Itens do pedido</h2>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Quantidade</th>
                          <th>Unitário</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.itens.map((item) => (
                          <tr key={item.produto_id}>
                            <td>{item.produto_nome}</td>
                            <td>{item.quantidade}</td>
                            <td>{money(item.preco_unitario)}</td>
                            <td>{money(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="summary-total">
                    <span>Total dos produtos</span>
                    <strong>{money(order.total)}</strong>
                  </div>
                </section>
                <section className="panel">
                  <h2>Histórico do pedido</h2>
                  <ol className="timeline">
                    {order.historico.map((item, index) => (
                      <li key={index}>
                        <StatusBadge status={item.status_novo} />
                        <small>
                          {dateTime(item.criado_em)}
                          {item.admin_nome && ` · ${item.admin_nome}`}
                        </small>
                        {item.observacao && <p className="preserve-lines">{item.observacao}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <div>
                <section className="panel">
                  <h2>Dados do cliente</h2>
                  <dl>
                    <dt>Nome</dt>
                    <dd>{order.cliente.nome}</dd>
                    <dt>Contato</dt>
                    <dd>{order.cliente.contato}</dd>
                    <dt>Observações</dt>
                    <dd className="preserve-lines">{order.observacoes || 'Nenhuma observação.'}</dd>
                  </dl>
                  {order.observacoes_adicionais?.map((note, index) => (
                    <div className="additional-note" key={index}>
                      <small>{dateTime(note.criado_em)}</small>
                      <p className="preserve-lines">{note.texto}</p>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>Próxima etapa</h2>
                  {transitions[order.status].length ? (
                    <form key={order.status} onSubmit={submit}>
                      <label>
                        Novo status
                        <select name="status" disabled={busy}>
                          {transitions[order.status].map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Observação interna <span className="optional">(opcional)</span>
                        <textarea name="observacao" maxLength={500} rows={3} disabled={busy} />
                      </label>
                      {order.status === 'solicitado' && (
                        <p className="field-hint">
                          Ao confirmar, os produtos são descontados do estoque. É necessário ter
                          saldo disponível.
                        </p>
                      )}
                      <button className="button button-primary button-full" disabled={busy}>
                        {busy ? 'Atualizando…' : 'Atualizar status'}
                      </button>
                    </form>
                  ) : (
                    <p className="muted">Este pedido foi encerrado.</p>
                  )}
                </section>
              </div>
            </div>
          </>
        )
      )}
      {pending && (
        <Modal title="Cancelar este pedido?" busy={busy} onClose={() => setPending(null)}>
          <p>
            O pedido será encerrado. Se houve baixa de estoque, as unidades serão devolvidas ao
            saldo.
          </p>
          <div className="form-actions">
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Voltar
            </button>
            <button
              className="button button-danger"
              disabled={busy}
              onClick={() => void update(pending)}
            >
              {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
