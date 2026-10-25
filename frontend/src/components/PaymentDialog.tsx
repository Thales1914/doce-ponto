import type { FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/Auth';
import { useMutation } from '../lib/useMutation';
import { ErrorNotice, Modal } from './UI';

export default function PaymentDialog({
  path,
  field,
  current,
  onClose,
  onSaved,
}: {
  path: string;
  field: 'status' | 'status_pagamento';
  current: 'recebido' | 'pendente';
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const mutation = useMutation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutation.run(async () => {
      await api(path, {
        token,
        method: 'PUT',
        body: {
          [field]: form.get('status'),
          ...(form.get('forma') && { forma: String(form.get('forma')).trim() }),
          ...(form.get('data') && { data: form.get('data') }),
        },
      });
      onSaved();
    });
  }
  return (
    <Modal title="Atualizar pagamento" onClose={onClose} busy={mutation.busy}>
      <form onSubmit={submit}>
        <ErrorNotice error={mutation.error} />
        <fieldset disabled={mutation.busy} className="form-fields">
          <label>
            Situação do pagamento
            <select name="status" defaultValue={current}>
              <option value="pendente">Pendente</option>
              <option value="recebido">Recebido</option>
            </select>
          </label>
          <label>
            Forma de pagamento (opcional)
            <input name="forma" maxLength={30} placeholder="Pix, dinheiro, transferência…" />
          </label>
          <label>
            Data do registro (opcional)
            <input name="data" type="date" />
          </label>
          <p className="field-hint">
            Ao marcar como recebido sem informar uma data, será usada a data de hoje. Este registro
            não realiza cobranças.
          </p>
          <button className="button button-primary">Salvar pagamento</button>
        </fieldset>
      </form>
    </Modal>
  );
}
