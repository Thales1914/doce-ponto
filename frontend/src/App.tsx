import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './context/Auth';
import { CartProvider } from './context/Cart';
import { PublicLayout, AdminLayout } from './components/Layouts';
import { Loading } from './components/UI';
import Catalog from './pages/Catalog';
const Checkout = lazy(() => import('./pages/Checkout'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Login = lazy(() => import('./pages/Login'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Products = lazy(() => import('./pages/Products'));
const Stock = lazy(() => import('./pages/Stock'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Restaurants = lazy(() => import('./pages/Restaurants'));
const Sales = lazy(() => import('./pages/Sales'));
const Finance = lazy(() => import('./pages/Finance'));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="auth-recovery">
        <h1>Não foi possível abrir esta página.</h1>
        <p>Tente recarregar para continuar.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          Recarregar página
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <a href="#conteudo" className="skip-link">
            Ir para o conteúdo
          </a>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Catalog />} />
                <Route path="pedido" element={<Checkout />} />
                <Route path="pedido-enviado/:numero" element={<Confirmation />} />
                <Route path="acompanhar" element={<Tracking />} />
                <Route path="acompanhar/:numero" element={<Tracking />} />
              </Route>
              <Route path="admin/login" element={<Login />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="pedidos" replace />} />
                <Route path="pedidos" element={<Orders />} />
                <Route path="pedidos/:id" element={<OrderDetail />} />
                <Route path="produtos" element={<Products />} />
                <Route path="estoque" element={<Stock />} />
                <Route path="restaurantes" element={<Restaurants />} />
                <Route path="vendas" element={<Sales />} />
                <Route path="financeiro" element={<Finance />} />
              </Route>
              <Route
                path="*"
                element={
                  <main id="conteudo" className="auth-recovery">
                    <h1>Página não encontrada</h1>
                    <p>O endereço pode ter sido alterado.</p>
                    <Link className="button button-primary" to="/">
                      Voltar ao início
                    </Link>
                  </main>
                }
              />
            </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
