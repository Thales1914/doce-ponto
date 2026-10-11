import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { Brand, ErrorNotice, SweetArt } from '../components/UI';
export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const lock = useRef(false);
  const destination =
    typeof location.state?.from === 'string' &&
    location.state.from.startsWith('/admin/') &&
    !location.state.from.startsWith('/admin/login')
      ? location.state.from
      : '/admin/pedidos';
  if (auth.token && auth.admin && !auth.loading && !auth.error)
    return <Navigate to={destination} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await auth.login(String(form.get('email')).trim(), String(form.get('senha')));
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="login-page" id="conteudo">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">CUIDADO EM CADA DETALHE</span>
          <h1>
            Por trás de cada doce,
            <br />
            <em>uma boa gestão.</em>
          </h1>
          <p>Seu espaço para organizar os pedidos e cuidar do que faz seu negócio especial.</p>
          <SweetArt />
        </div>
        <small>DocePonto · Área administrativa</small>
      </section>
      <section className="login-form-area">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Voltar ao cardápio
        </Link>
        <div className="login-form">
          <div className="summary-icon">
            <LockKeyhole size={24} />
          </div>
          <span className="eyebrow">BEM-VINDA DE VOLTA</span>
          <h2>Vamos cuidar dos pedidos?</h2>
          <p>Entre com sua conta administrativa.</p>
          <form onSubmit={submit}>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={255}
                placeholder="Seu e-mail"
                disabled={busy}
              />
            </label>
            <label>
              Senha
              <div className="password-field">
                <input
                  name="senha"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Sua senha"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <ErrorNotice error={error} />
            <button type="submit" className="button button-primary button-full" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar no painel'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-footnote">
            <LockKeyhole size={14} />
            Acesso exclusivo à administração.
          </p>
        </div>
      </section>
    </main>
  );
}
