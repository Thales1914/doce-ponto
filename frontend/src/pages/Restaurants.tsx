import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { useMutation } from '../lib/useMutation';
import { Empty, ErrorNotice, Loading, Modal, PageHeader, Success } from '../components/UI';
import type { Restaurant } from '../types';

export default function Restaurants() {
  const { token } = useAuth();
  const list = useResource<Restaurant[]>('/restaurantes', token);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Restaurant | 'new' | null>(null);
  const [success, setSuccess] = useState('');
  const mutation = useMutation();
  const selected = editing && editing !== 'new' ? editing : null;
  const rows = list.data?.filter((r) =>
    r.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutation.run(async () => {
      const nome = String(form.get('nome')).trim();
      if (nome.length < 2) throw new ApiError('Informe um nome com ao menos dois caracteres.');
      await api(selected ? `/restaurantes/${selected.id}` : '/restaurantes', {
        token,
        method: selected ? 'PUT' : 'POST',
        body: { nome, contato: String(form.get('contato')).trim() || null },
      });
      setSuccess(selected ? 'Restaurante atualizado.' : 'Restaurante cadastrado.');
      setEditing(null);
      list.reload();
    });
  }
  function open(row: Restaurant | 'new') {
    mutation.reset();
    setSuccess('');
    setEditing(row);
  }
  return (
    <>
      <PageHeader
        eyebrow="PARCEIROS DO NEGÓCIO"
        title="Restaurantes"
        description="Organize os estabelecimentos que compram seus doces."
        action={
          <button className="button button-primary" onClick={() => open('new')}>
            Novo restaurante
          </button>
        }
      />
      {success && <Success>{success}</Success>}
      <section className="panel">
        <label>
          Buscar restaurante
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do estabelecimento"
          />
        </label>
        <ErrorNotice error={list.error} retry={list.reload} />
        {list.loading ? (
          <Loading />
        ) : (
          rows &&
          (rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Restaurante</th>
                    <th>Contato</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nome}</td>
                      <td>{r.contato || 'Não informado'}</td>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => open(r)}
                          aria-label={`Editar ${r.nome}`}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Nenhum restaurante encontrado">
              Cadastre um estabelecimento ou ajuste a busca.
            </Empty>
          ))
        )}
      </section>
      {editing && (
        <Modal
          title={selected ? 'Editar restaurante' : 'Novo restaurante'}
          busy={mutation.busy}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <ErrorNotice error={mutation.error} />
            <fieldset className="form-fields" disabled={mutation.busy}>
              <label>
                Nome do restaurante
                <input
                  name="nome"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={selected?.nome}
                />
              </label>
              <label>
                Contato (opcional)
                <input name="contato" maxLength={120} defaultValue={selected?.contato || ''} />
              </label>
              <button className="button button-primary">Salvar restaurante</button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
