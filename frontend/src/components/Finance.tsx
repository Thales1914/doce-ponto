import { type FormEvent, type ReactNode } from 'react';
import { paymentLabels, paymentMethods, today } from '../lib/format';
import type { EntryStatus } from '../types';
import { ErrorNotice, Modal } from './UI';

const paymentTone: Record<EntryStatus, string> = {
  pendente: '',
  recebido: 'status-entregue',
  cancelado: 'status-cancelado',
};
export function PaymentBadge({ status }: { status: EntryStatus }) {
  return (
    <span className={`status ${paymentTone[status]}`}>
      <i />
      {paymentLabels[status]}
    </span>
  );
}
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: 'good' | 'alert';
}) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function PaymentMethodField({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <label>
      Forma de pagamento <span className="optional">(opcional)</span>
      <input
        name="forma"
        list="formas-pagamento"
        maxLength={30}
        placeholder="Pix, dinheiro…"
        defaultValue={defaultValue || ''}
      />
      <datalist id="formas-pagamento">
        {paymentMethods.map((method) => (
          <option key={method} value={method} />
        ))}
      </datalist>
    </label>
  );
}
export function ReceiveModal({
  title,
  description,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (values: { forma?: string; data?: string }) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const forma = String(form.get('forma')).trim();
    const data = String(form.get('data'));
    onConfirm({ ...(forma && { forma }), ...(data && { data }) });
  }
  return (
    <Modal title={title} busy={busy} onClose={onClose}>
      <form onSubmit={submit}>
        <p>{description}</p>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <PaymentMethodField />
            <label>
              Data do recebimento
              <input name="data" type="date" required max={today()} defaultValue={today()} />
            </label>
          </div>
        </fieldset>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <button type="button" className="button button-quiet" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Confirmar recebimento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReopenModal({
  description,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  description: ReactNode;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Voltar para a receber?" busy={busy} onClose={onClose}>
      <p>{description}</p>
      <ErrorNotice error={error} />
      <div className="form-actions">
        <button className="button button-quiet" disabled={busy} onClick={onClose}>
          Voltar
        </button>
        <button className="button button-danger" disabled={busy} onClick={onConfirm}>
          {busy ? 'Salvando…' : 'Marcar como a receber'}
        </button>
      </div>
    </Modal>
  );
}
