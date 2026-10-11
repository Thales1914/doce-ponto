import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/Cart';
import { api, ApiError } from '../lib/api';
import { useResource } from '../lib/useResource';
import { money } from '../lib/format';
import { Empty, ErrorNotice, Loading, PageHeader } from '../components/UI';
import type { Product, Receipt } from '../types';

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const { data: products, error: loadError, loading, reload } = useResource<Product[]>('/produtos');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [customer, setCustomer] = useState({ nome: '', contato: '', observacoes: '' });
  const total =
    cart.items.reduce(
      (value, item) =>
        value +
        Math.round((products?.find((p) => p.id === item.id)?.preco || 0) * 100) * item.quantity,
      0,
    ) / 100;
  const unavailable =
    products && cart.items.some((item) => !products.some((p) => p.id === item.id));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !products || !cart.items.length || unavailable) return;
    const form = new FormData(event.currentTarget);
    const nome = String(form.get('nome')).trim(),
      contato = String(form.get('contato')).trim();
    if (nome.length < 2) {
      setError(new ApiError('Informe seu nome com pelo menos 2 caracteres.'));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api<Receipt>('/pedidos', {
        method: 'POST',
        body: {
          cliente: { nome, contato },
          itens: cart.items.map((item) => ({ produto_id: item.id, quantidade: item.quantity })),
          observacoes: String(form.get('observacoes')).trim() || null,
        },
      });
      cart.clear();
      navigate(`/pedido-enviado/${result.numero_pedido}`, {
        replace: true,
        state: { receipt: result },
      });
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.status === 400) reload();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="public-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={17} />
        Voltar ao cardápio
      </Link>
      <PageHeader
        eyebrow="QUASE PRONTO"
        title="Seu pedido, do seu jeito."
        description="Confira os doces e conte como podemos falar com você."
      />
      <ErrorNotice error={loadError} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        !loadError &&
        (!cart.items.length ? (
          <div className="panel">
            <Empty title="Seu pedido ainda está vazio">
              Escolha os doces que vão fazer parte deste momento.
            </Empty>
            <Link className="button button-primary centered-button" to="/">
              Explorar cardápio <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <form className="checkout-grid" onSubmit={submit}>
            <div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    <ShoppingBag size={20} /> Sua seleção
                  </h2>
                  <span>{cart.count} unidades</span>
                </div>
                {unavailable && (
                  <div className="notice notice-error" role="alert">
                    Um produto ficou indisponível. Remova-o para continuar.
                  </div>
                )}
                <div className="cart-items">
                  {cart.items.map((item) => {
                    const product = products?.find((p) => p.id === item.id);
                    return (
                      <div className="cart-item" key={item.id}>
                        <div className="cart-item-name">
                          <strong>{product?.nome || 'Produto indisponível'}</strong>
                          <small>
                            {product
                              ? `${money(product.preco)} / unidade`
                              : 'Remova este item do pedido.'}
                          </small>
                        </div>
                        <div className="quantity-control">
                          <button
                            type="button"
                            disabled={busy || item.quantity <= 1}
                            aria-label={`Diminuir ${product?.nome}`}
                            onClick={() => cart.setQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus size={15} />
                          </button>
                          <input
                            aria-label={`Quantidade de ${product?.nome}`}
                            type="number"
                            min="1"
                            max="1000"
                            required
                            value={item.quantity}
                            disabled={busy}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isInteger(n) && n >= 1 && n <= 1000)
                                cart.setQuantity(item.id, n);
                            }}
                          />
                          <button
                            type="button"
                            disabled={busy || item.quantity >= 1000}
                            aria-label={`Aumentar ${product?.nome}`}
                            onClick={() => cart.setQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                        <strong>{product && money(product.preco * item.quantity)}</strong>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={busy}
                          aria-label={`Remover ${product?.nome || 'produto indisponível'}`}
                          onClick={() => cart.setQuantity(item.id, 0)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="panel">
                <h2>Seus dados</h2>
                <p className="muted">Não precisa criar uma conta para fazer seu pedido.</p>
                <div className="form-grid">
                  <label>
                    Seu nome
                    <input
                      name="nome"
                      value={customer.nome}
                      onChange={(e) => setCustomer({ ...customer, nome: e.target.value })}
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Como podemos chamar você?"
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Telefone ou e-mail
                    <input
                      name="contato"
                      value={customer.contato}
                      onChange={(e) => setCustomer({ ...customer, contato: e.target.value })}
                      required
                      minLength={5}
                      maxLength={120}
                      autoComplete="email"
                      placeholder="Seu melhor contato"
                      disabled={busy}
                    />
                  </label>
                </div>
                <label>
                  Observações <span className="optional">(opcional)</span>
                  <textarea
                    name="observacoes"
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })}
                    maxLength={1000}
                    rows={3}
                    placeholder="Algum detalhe importante sobre a encomenda?"
                    disabled={busy}
                  />
                </label>
              </section>
            </div>
            <aside className="panel order-summary">
              <span className="eyebrow">FEITO COM CARINHO</span>
              <h2>Resumo do pedido</h2>
              <div className="summary-line">
                <span>Produtos ({cart.count} unidades)</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="summary-total">
                <span>Total dos produtos</span>
                <strong>{money(total)}</strong>
              </div>
              <p>
                Seu pedido será recebido para confirmação. Os detalhes de entrega ou retirada e
                pagamento serão combinados pelo contato informado.
              </p>
              <ErrorNotice error={error} />
              <button
                className="button button-primary button-full"
                type="submit"
                disabled={busy || Boolean(unavailable)}
              >
                {busy ? 'Enviando pedido…' : 'Enviar pedido'}
                <ArrowRight size={17} />
              </button>
              <small>Nenhum pagamento é cobrado nesta etapa.</small>
            </aside>
          </form>
        ))
      )}
    </div>
  );
}
