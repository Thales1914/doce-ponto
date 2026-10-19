import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { useResource } from '../lib/useResource';
import { useMutation } from '../lib/useMutation';
import { api, ApiError } from '../lib/api';
import { dateTime, money, statusLabels } from '../lib/format';
import { ErrorNotice, Loading, StatusBadge, Success } from '../components/UI';
import type { OrderStatus, Tracking } from '../types';

const STEPS: OrderStatus[] = ['solicitado', 'confirmado', 'em_producao', 'pronto', 'entregue'];
const ORDER_CODE = /^PED-[A-HJKMNP-Z2-9]{8}$/;

function SearchForm({ initial = '' }: { initial?: string }) {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('numero')).trim().toUpperCase();
    if (!ORDER_CODE.test(code)) {
      setError(new ApiError('Confira o código: ele tem o formato PED-XXXXXXXX.'));
      return;
    }
    setError(null);
    navigate(`/acompanhar/${code}`);
  }
  return (
    <form className="track-search" onSubmit={submit}>
      <label>
        Número do pedido
        <span className="search-field">
          <Search size={18} />
          <input
            name="numero"
            required
            autoComplete="off"
            placeholder="PED-XXXXXXXX"
            defaultValue={initial}
            maxLength={12}
          />
        </span>
      </label>
      <button className="button button-primary">Acompanhar</button>
      <ErrorNotice error={error} />
    </form>
  );
}
function Progress({ status }: { status: OrderStatus }) {
  if (status === 'cancelado')
    return (
      <p className="notice notice-error" role="status">
        Este pedido foi cancelado. Em caso de dúvida, fale com a equipe.
      </p>
    );
  const current = STEPS.indexOf(status);
  return (
    <ol className="progress" aria-label="Andamento do pedido">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className={index < current ? 'done' : index === current ? 'current' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          <i>{index < current ? <Check size={13} /> : index + 1}</i>
          <span>{statusLabels[step]}</span>
        </li>
      ))}
    </ol>
  );
}
function Details({ numero }: { numero: string }) {
  const { data, error, loading, reload } = useResource<Tracking>(
    `/pedidos/${encodeURIComponent(numero)}`,
  );
  const mutation = useMutation();
  const [text, setText] = useState(''),
    [success, setSuccess] = useState('');
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const texto = text.trim();
    if (!texto) {
      mutation.setError(new ApiError('Escreva a observação antes de enviar.'));
      return;
    }
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api(`/pedidos/${encodeURIComponent(numero)}/observacoes`, {
        method: 'POST',
        body: { texto },
      });
    });
    if (ok) {
      setText('');
      setSuccess('Observação enviada para a equipe.');
      reload();
    }
  }
  if (loading) return <Loading />;
  if (error)
    return (
      <ErrorNotice
        error={
          error instanceof ApiError && error.status === 404
            ? new ApiError('Não encontramos um pedido com esse número. Confira o código.')
            : error
        }
        retry={error instanceof ApiError && error.status === 404 ? undefined : reload}
      />
    );
  if (!data) return null;
  const open = !['entregue', 'cancelado'].includes(data.status);
  return (
    <>
      <section className="panel track-status">
        <div className="panel-heading">
          <div>
            <small className="eyebrow">PEDIDO</small>
            <h2>{data.numero_pedido}</h2>
          </div>
          <StatusBadge status={data.status} />
        </div>
        <p className="track-description">{data.status_descricao}</p>
        <Progress status={data.status} />
        <small className="muted">
          Feito em {dateTime(data.criado_em)} · Atualizado em {dateTime(data.atualizado_em)}
        </small>
      </section>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2>Seus doces</h2>
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
          </section>
          <section className="panel">
            <h2>Histórico</h2>
            <ol className="timeline">
              {data.historico.map((item, index) => (
                <li key={index}>
                  <StatusBadge status={item.status} />
                  <small>{dateTime(item.data)}</small>
                  <p>{item.status_descricao}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div>
          <section className="panel">
            <h2>Observações</h2>
            <p className="preserve-lines">{data.observacoes || 'Nenhuma observação no pedido.'}</p>
            {data.observacoes_adicionais.map((note, index) => (
              <div className="additional-note" key={index}>
                <small>{dateTime(note.criado_em)}</small>
                <p className="preserve-lines">{note.texto}</p>
              </div>
            ))}
            {success && <Success>{success}</Success>}
            {open ? (
              <form onSubmit={addNote}>
                <label>
                  Adicionar observação
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={text}
                    disabled={mutation.busy}
                    placeholder="Ex.: prefiro retirar depois das 17h."
                    onChange={(e) => setText(e.target.value)}
                  />
                </label>
                <ErrorNotice error={mutation.error} />
                <button className="button button-primary button-full" disabled={mutation.busy}>
                  {mutation.busy ? 'Enviando…' : 'Enviar observação'}
                </button>
              </form>
            ) : (
              <p className="muted">Este pedido foi encerrado e não recebe novas observações.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
export default function Track() {
  const { numero = '' } = useParams();
  const code = numero.toUpperCase();
  return (
    <div className="public-page track-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Voltar ao cardápio
      </Link>
      <span className="eyebrow">ACOMPANHE SUA ENCOMENDA</span>
      <h1>Como está meu pedido?</h1>
      <p className="muted">Informe o código que você recebeu ao enviar o pedido.</p>
      <SearchForm key={code} initial={code} />
      {code &&
        (ORDER_CODE.test(code) ? (
          <Details key={code} numero={code} />
        ) : (
          <ErrorNotice error={new ApiError('Confira o código: ele tem o formato PED-XXXXXXXX.')} />
        ))}
    </div>
  );
}
