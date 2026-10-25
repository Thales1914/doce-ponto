import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  Package,
  ArrowLeftRight,
  LogOut,
  ArrowUpRight,
  ShoppingBag,
  Heart,
  Store,
  Wallet,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { Brand, ErrorNotice, Loading } from './UI';

export function PublicLayout() {
  const cart = useCart();
  return (
    <div className="public-shell">
      <div className="announcement">Pequenos doces. Bons momentos.</div>
      <header className="store-header">
        <Brand />
        <nav aria-label="Navegação principal">
          <NavLink to="/" end>
            Cardápio
          </NavLink>
          <NavLink to="/acompanhar" className="tracking-link">
            Acompanhar pedido
          </NavLink>
          <Link to="/#como-pedir" className="how-link">
            Como pedir
          </Link>
          <Link className="cart-link" to="/pedido">
            <ShoppingBag size={19} />
            <span>Seu pedido</span>
            <b>{cart.count}</b>
          </Link>
        </nav>
      </header>
      <main id="conteudo">
        <Outlet />
      </main>
      <footer className="store-footer">
        <Brand />
        <span>
          Um pouco de carinho em cada escolha. <Heart size={13} />
        </span>
        <Link to="/admin">
          Área administrativa <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
export function AdminLayout() {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.token)
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
    );
  if (auth.loading) return <Loading />;
  if (auth.error)
    return (
      <main className="auth-recovery">
        <ErrorNotice error={auth.error} retry={auth.retry} />
        <button className="button button-quiet" onClick={auth.logout}>
          Voltar ao login
        </button>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">ÁREA ADMINISTRATIVA</div>
        <nav aria-label="Painel administrativo">
          <NavLink to="/admin/dashboard">
            <LayoutDashboard size={20} />
            Visão geral
          </NavLink>
          <NavLink to="/admin/pedidos">
            <ClipboardList size={20} />
            Pedidos
          </NavLink>
          <NavLink to="/admin/produtos">
            <Package size={20} />
            Produtos
          </NavLink>
          <NavLink to="/admin/estoque">
            <ArrowLeftRight size={20} />
            Estoque
          </NavLink>
          <NavLink to="/admin/restaurantes">
            <Store size={20} />
            Restaurantes
          </NavLink>
          <NavLink to="/admin/vendas">
            <ShoppingBag size={20} />
            Vendas
          </NavLink>
          <NavLink to="/admin/financeiro">
            <Wallet size={20} />
            Financeiro
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <Link to="/">
            Ver o cardápio <ArrowUpRight size={16} />
          </Link>
          <div className="admin-user">
            <span className="avatar">{auth.admin?.nome.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{auth.admin?.nome}</strong>
              <small>Administração</small>
            </div>
            <button aria-label="Sair da conta" className="icon-button" onClick={auth.logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <span>Seu negócio, com mais cuidado.</span>
          <span className="workspace-label">
            <i /> Espaço de gestão
          </span>
        </header>
        <main id="conteudo" className="admin-content">
          <Outlet />
        </main>
        <footer className="admin-footer">DocePonto · Cada detalhe faz a diferença.</footer>
      </div>
    </div>
  );
}
