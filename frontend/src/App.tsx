import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/Auth';
import { CartProvider } from './context/Cart';
import { PublicLayout } from './components/Layouts';
import { Loading } from './components/UI';
import Catalog from './pages/Catalog';
const Checkout = lazy(() => import('./pages/Checkout'));
const Confirmation = lazy(() => import('./pages/Confirmation'));

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
