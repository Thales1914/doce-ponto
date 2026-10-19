import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { useMutation } from '../lib/useMutation';
import { api, ApiError } from '../lib/api';
import { PageHeader, ErrorNotice, Loading, Empty, Success, Modal } from '../components/UI';
import type { Restaurant } from '../types';

export default function Restaurants() {
  const { token } = useAuth();
  const { data, error, loading, reload } = useResource<Restaurant[]>('/restaurantes', token);
  const [search, setSearch] = useState(''),
    [editing, setEditing] = useState<Restaurant | 'new' | null>(null),
    [success, setSuccess] = useState('');
  const mutation = useMutation();
  const selected = editing && editing !== 'new' ? editing : null;
  const restaurants = data?.filter((r) =>
    `${r.nome} ${r.contato || ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nome = String(form.get('nome')).trim();
    const contato = String(form.get('contato')).trim() || null;
    if (nome.length < 2) {
      mutation.setError(new ApiError('Informe o nome do restaurante, com pelo menos 2 letras.'));
      return;
    }
    setSuccess('');
    const ok = await mutation.run(async () => {
      await api(selected ? `/restaurantes/${selected.id}` : '/restaurantes', {
        method: selected ? 'PUT' : 'POST',
        token,
        body: { nome, contato },
      });
    });
    if (ok) {
      setEditing(null);
      setSuccess(selected ? 'Restaurante atualizado.' : 'Restaurante cadastrado.');
      reload();
    }
  }
  function open(restaurant: Restaurant | 'new') {
    mutation.setError(null);
    setEditing(restaurant);
  }
  return (
    <>
      <PageHeader
        eyebrow="PARCEIROS QUE REVENDEM"
        title="Restaurantes"
        description="Cadastre os restaurantes e cafés que compram seus doces para revenda."
        action={
          <button className="button button-primary" onClick={() => open('new')}>
            <Plus size={18} />
            Novo restaurante
          </button>
        }
      />
      {success && <Success>{success}</Success>}
      <section className="panel">
        <div className="filters">
          <label className="filter-search">
            Buscar restaurante
            <input
              placeholder="Nome ou contato"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <ErrorNotice error={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : (
          restaurants &&
          (restaurants.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Restaurante</th>
                    <th>Contato</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.nome}</strong>
                      </td>
                      <td>{r.contato || '—'}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="table-link"
                            to={`/admin/vendas?restaurante_id=${r.id}`}
                            aria-label={`Ver vendas para ${r.nome}`}
                          >
                            Ver vendas
                            <ArrowUpRight size={15} />
                          </Link>
                          <button
                            className="table-link"
                            onClick={() => open(r)}
                            aria-label={`Editar ${r.nome}`}
                          >
                            <Pencil size={15} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Nenhum restaurante encontrado">
              Cadastre o primeiro parceiro ou ajuste a busca.
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
            <fieldset disabled={mutation.busy}>
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
                Contato <span className="optional">(opcional)</span>
                <input
                  name="contato"
                  maxLength={120}
                  placeholder="Telefone, e-mail ou responsável"
                  defaultValue={selected?.contato || ''}
                />
              </label>
            </fieldset>
            <ErrorNotice error={mutation.error} />
            <div className="form-actions">
              <button
                type="button"
                className="button button-quiet"
                disabled={mutation.busy}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="button button-primary" disabled={mutation.busy}>
                {mutation.busy ? 'Salvando…' : 'Salvar restaurante'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
