import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime, money } from '../lib/format';
import { ErrorNotice, Loading, PageHeader, StatusBadge, Success } from '../components/UI';
import type { TrackedOrder } from '../types';

const validCode = /^PED-[A-HJKMNP-Z2-9]{8}$/;

function OrderProgress({ code }: { code: string }) {
  const { data, error, loading, reload } = useResource<TrackedOrder>(
    `/pedidos/${encodeURIComponent(code)}`,
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [mutationError, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState('');
  const lock = useRef(false);
  const closed = data?.status === 'entregue' || data?.status === 'cancelado';

  // Consulta a mesma visão pública que reflete as alterações da administração.
  useEffect(() => {
    if (closed || busy || error) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [closed, busy, error, reload]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const texto = note.trim();
    if (!texto || texto.length > 1000) {
      setError(new ApiError('Escreva uma observação de até 1.000 caracteres.'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await api(`/pedidos/${encodeURIComponent(code)}/observacoes`, {
        method: 'POST',
        body: { texto },
      });
      setNote('');
      setSuccess('Observação enviada para a equipe.');
      reload();
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label="Andamento do pedido" aria-busy={loading}>
      <ErrorNotice error={error} retry={reload} />
      {success && <Success>{success}</Success>}
      {loading && <Loading />}
      {!loading && data && (
        <>
          <PageHeader
            eyebrow="SUA ENCOMENDA"
            title={data.numero_pedido}
            description={data.status_descricao}
            action={
              <button className="button button-quiet" disabled={busy} onClick={reload}>
                Atualizar andamento
              </button>
            }
          />
          <div className="detail-grid">
            <div>
              <section className="panel">
                <h2>Andamento</h2>
                <StatusBadge status={data.status} />
                <p className="muted">Última alteração: {dateTime(data.atualizado_em)}</p>
                <ol className="timeline">
                  {data.historico.map((item, index) => (
                    <li key={index}>
                      <StatusBadge status={item.status} />
                      <small>{dateTime(item.data)}</small>
                      <p>{item.status_descricao}</p>
                    </li>
                  ))}
                </ol>
                {!closed && (
                  <p className="field-hint">
                    O andamento é atualizado a cada 30 segundos enquanto esta página está aberta.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Itens do pedido</h2>
                <div className="receipt-items">
                  {data.itens.map((item) => (
                    <div key={item.produto_id}>
                      <span>
                        {item.quantidade}× {item.produto_nome}
                      </span>
                      <strong>{money(item.subtotal)}</strong>
                    </div>
                  ))}
                  <div className="receipt-total">
                    <span>Total dos produtos</span>
                    <strong>{money(data.total)}</strong>
                  </div>
                </div>
                {data.observacoes && (
                  <>
                    <h3>Observação do pedido</h3>
                    <p className="preserve-lines">{data.observacoes}</p>
                  </>
                )}
              </section>
            </div>
            <section className="panel">
              <h2>Informações para a equipe</h2>
              {data.observacoes_adicionais.map((item, index) => (
                <div className="additional-note" key={index}>
                  <small>{dateTime(item.criado_em)}</small>
                  <p className="preserve-lines">{item.texto}</p>
                </div>
              ))}
              {closed ? (
                <p>Este pedido foi encerrado. Não é possível enviar novas observações.</p>
              ) : (
                <form onSubmit={send}>
                  <ErrorNotice error={mutationError} />
                  <label>
                    Nova observação
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={4}
                      maxLength={1000}
                      required
                      disabled={busy}
                    />
                  </label>
                  <p className="field-hint">
                    Inclua orientações sobre a encomenda. Não envie senhas ou dados de pagamento.
                  </p>
                  <button className="button button-primary" disabled={busy}>
                    {busy ? 'Enviando…' : 'Enviar observação'}
                  </button>
                </form>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export default function Tracking() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(numero || '');
  const [error, setError] = useState<unknown>(null);
  const code = numero?.trim().toUpperCase() || '';
  useEffect(() => {
    setInput(numero || '');
    setError(null);
  }, [numero]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim().toUpperCase();
    if (!validCode.test(next)) {
      setError(new ApiError('Confira o código recebido na confirmação, como PED-ABCDEFGH.'));
      return;
    }
    setError(null);
    navigate(`/acompanhar/${encodeURIComponent(next)}`);
  }
  return (
    <div className="public-page">
      <Link to="/" className="back-link">
        Voltar ao cardápio
      </Link>
      <PageHeader
        eyebrow="DO PEDIDO À ENTREGA"
        title="Acompanhe seu pedido"
        description="Use o código recebido na confirmação para consultar sua encomenda."
      />
      <form className="panel tracking-search" onSubmit={search}>
        <label>
          Código do pedido
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="PED-ABCDEFGH"
            maxLength={30}
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
        </label>
        <button className="button button-primary">Consultar pedido</button>
      </form>
      <ErrorNotice
        error={
          error ||
          (code && !validCode.test(code)
            ? new ApiError('Código de pedido inválido. Confira o número recebido na confirmação.')
            : null)
        }
      />
      {validCode.test(code) && <OrderProgress key={code} code={code} />}
    </div>
  );
}
