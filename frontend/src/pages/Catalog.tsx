import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, Heart, Plus, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { useResource } from '../lib/useResource';
import { money } from '../lib/format';
import { useCart } from '../context/Cart';
import { Empty, ErrorNotice, Loading, SweetArt } from '../components/UI';
import type { Product } from '../types';

export default function Catalog() {
  const { data, loading, error, reload } = useResource<Product[]>('/produtos');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const cart = useCart();
  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#como-pedir')
      document.getElementById('como-pedir')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);
  const products = (data || []).filter((p) =>
    p.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> DOÇURA NOS PEQUENOS MOMENTOS
          </span>
          <h1>
            Um doce momento,
            <br />
            <em>do seu jeito.</em>
          </h1>
          <p>Escolha seus favoritos, monte sua encomenda e deixe o resto com a gente.</p>
          <a className="button button-primary" href="#cardapio">
            Escolher meus doces <ArrowRight size={18} />
          </a>
          <div className="hero-note">
            <Heart size={16} /> Um pedido feito com carinho, do começo ao fim.
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <span className="art-orbit orbit-one" />
          <span className="art-orbit orbit-two" />
          <span className="art-star star-one">✧</span>
          <span className="art-star star-two">✦</span>
          <div className="hero-candy candy-back">
            <SweetArt variant={1} />
          </div>
          <div className="hero-candy candy-front">
            <SweetArt />
          </div>
          <div className="hero-stamp">
            feito para
            <br />
            <strong>adoçar</strong>
            <span>seu dia</span>
          </div>
        </div>
      </section>
      <section className="catalog-section" id="cardapio">
        <div className="section-heading">
          <div>
            <span className="eyebrow">O QUE VAI ADOÇAR SEU DIA?</span>
            <h2>Nosso cardápio</h2>
            <p>Escolha os doces e as quantidades para sua encomenda.</p>
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar doce"
              placeholder="Encontre seu favorito…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="catalog-layout">
          <div>
            <ErrorNotice error={error} retry={reload} />
            {loading ? (
              <Loading />
            ) : (
              !error &&
              (products.length ? (
                <div className="product-grid">
                  {products.map((product, index) => {
                    const quantity = cart.items.find((x) => x.id === product.id)?.quantity || 0;
                    const limit = quantity >= 1000 || (!quantity && cart.items.length >= 50);
                    return (
                      <article className="product-card" key={product.id}>
                        <div className={`product-art tone-${index % 3}`}>
                          <SweetArt variant={index} />
                          <span className="product-tag">Um toque de doçura</span>
                        </div>
                        <div className="product-copy">
                          <h3>{product.nome}</h3>
                          <p>
                            {product.descricao ||
                              'Um doce para fazer parte dos seus bons momentos.'}
                          </p>
                          <div className="product-bottom">
                            <div>
                              <small>por unidade</small>
                              <strong>{money(product.preco)}</strong>
                            </div>
                            <button
                              className="add-button"
                              disabled={limit}
                              aria-label={`Adicionar ${product.nome}`}
                              onClick={() => {
                                cart.add(product.id);
                                setNotice(`${product.nome} adicionado ao pedido.`);
                              }}
                            >
                              {quantity ? <Check size={18} /> : <Plus size={18} />}{' '}
                              {quantity ? `${quantity} no pedido` : 'Adicionar'}
                            </button>
                          </div>
                          {limit && (
                            <small className="field-hint">
                              Limite de quantidade ou de produtos atingido.
                            </small>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  title={search ? 'Nenhum doce encontrado' : 'O cardápio está sendo preparado'}
                >
                  {search
                    ? 'Tente buscar por outro nome.'
                    : 'Volte em breve para conferir os produtos disponíveis.'}
                </Empty>
              ))
            )}
          </div>
          <aside className="cart-summary">
            <div className="summary-icon">
              <ShoppingBag size={23} />
            </div>
            <h3>Seu momento doce</h3>
            <p>
              {cart.count
                ? `${cart.count} unidade${cart.count > 1 ? 's' : ''} no seu pedido.`
                : 'Seus favoritos vão aparecer por aqui.'}
            </p>
            {cart.items.length > 0 && data && (
              <ul className="mini-cart">
                {cart.items.map((item) => {
                  const product = data.find((p) => p.id === item.id);
                  return (
                    <li key={item.id}>
                      <span>
                        {item.quantity}× {product?.nome || 'Produto indisponível'}
                      </span>
                      {product && <strong>{money(product.preco * item.quantity)}</strong>}
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              className={`button ${cart.count ? 'button-primary' : 'button-quiet'}`}
              to="/pedido"
            >
              Revisar pedido <ArrowRight size={17} />
            </Link>
            <small>Você confere tudo antes de enviar.</small>
          </aside>
        </div>
        <div className="sr-only" aria-live="polite">
          {notice}
        </div>
      </section>
      <section className="how-section" id="como-pedir">
        <span className="eyebrow">SIMPLES ASSIM</span>
        <h2>Do seu desejo à sua encomenda.</h2>
        <div className="how-grid">
          {[
            ['01', 'Escolha seus doces', 'Adicione seus favoritos e ajuste as quantidades.'],
            ['02', 'Conte para a gente', 'Informe seu nome, contato e os detalhes do pedido.'],
            ['03', 'Guarde seu código', 'Receba o número da encomenda após o envio.'],
          ].map(([n, title, description]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
