import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, ArrowLeft } from 'lucide-react';
import { useResource } from '../lib/useResource';
import { money } from '../lib/format';
import { ErrorNotice, Loading } from '../components/UI';
import type { Receipt } from '../types';
export default function Confirmation() {
  const { numero } = useParams();
  const { data, error, loading, reload } = useResource<Receipt>(
    `/pedidos/${encodeURIComponent(numero || '')}`,
  );
  const [copied, setCopied] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.numero_pedido);
      setCopied('Código copiado!');
    } catch {
      setCopied('Selecione o código acima e copie para guardar.');
    }
  }
  return (
    <div className="confirmation-page">
      <ErrorNotice error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <section className="panel confirmation">
            <div className="confirmation-check">
              <Check size={34} />
            </div>
            <span className="eyebrow">OBRIGADO POR ESCOLHER A GENTE</span>
            <h1>Seu pedido foi recebido!</h1>
            <p>Mais um momento doce a caminho. Guarde o código da sua encomenda.</p>
            <div className="order-code">
              <small>NÚMERO DO PEDIDO</small>
              <strong>{data.numero_pedido}</strong>
              <button className="text-button" onClick={copy}>
                <Copy size={16} />
                Copiar código
              </button>
              <span aria-live="polite">{copied}</span>
            </div>
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
            <p className="small-copy">
              A equipe entrará em contato para combinar a confirmação, a entrega ou retirada e o
              pagamento.
            </p>
            <Link to="/" className="button button-primary">
              <ArrowLeft size={17} />
              Voltar ao cardápio
            </Link>
          </section>
        )
      )}
    </div>
  );
}
