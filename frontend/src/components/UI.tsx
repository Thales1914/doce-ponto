import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, LoaderCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError, errorMessage } from '../lib/api';
import { statusLabels } from '../lib/format';
import type { OrderStatus, Page } from '../types';

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="DocePonto, início">
      <img src="/favicon.svg" width="38" height="38" alt="" />
      <span>
        Doce<span className="brand-accent">Ponto</span>
        <small>FEITO PARA ADOÇAR</small>
      </span>
    </Link>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Só um instante…
    </div>
  );
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="notice notice-error" role="alert">
      <AlertCircle size={20} />
      <div>
        <p>{errorMessage(error)}</p>
        {error instanceof ApiError && error.details.length > 0 && (
          <ul>
            {[...new Set(error.details.map((x) => x.mensagem))].map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
        {retry && (
          <button className="text-button" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="notice notice-success" role="status">
      {children}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-mark">✧</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Pagination({
  meta,
  onPage,
}: {
  meta: Page<unknown>['meta'];
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {meta.total} registro{meta.total !== 1 ? 's' : ''} · Página {meta.page} de{' '}
        {Math.max(1, meta.total_paginas)}
      </span>
      <div>
        <button
          className="button button-quiet"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Página anterior"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="button button-quiet"
          disabled={meta.page >= meta.total_paginas}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Próxima página"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SweetArt({ variant = 0 }: { variant?: number }) {
  return (
    <svg className={`sweet-art variant-${variant % 3}`} viewBox="0 0 260 180" aria-hidden="true">
      <ellipse cx="130" cy="147" rx="73" ry="12" fill="currentColor" opacity=".10" />
      <path d="M63 107h134l-23 42H86z" fill="#dcae8c" />
      <path
        d="m76 107 13 39m12-39 7 41m21-41v43m23-43-7 41m25-41-12 39m28-39-18 40"
        stroke="#bd8768"
        strokeWidth="3"
      />
      <circle cx="130" cy="83" r="57" fill="currentColor" />
      <g stroke="#f8d9b9" strokeWidth="5" strokeLinecap="round" opacity=".75">
        <path d="m98 58 6 5m23-19-2 9m28 1 7-5m7 29 8 2m-70 10 4-7m16-16 8 3m9 26-3 7m-51 12 9 2m46 11 7-5m-8-32 5 7m-62-21 1 8" />
      </g>
    </svg>
  );
}
