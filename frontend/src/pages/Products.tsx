import { useRef, useState, type FormEvent } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { useResource } from '../lib/useResource';
import { api, ApiError } from '../lib/api';
import { money, parsePrice } from '../lib/format';
import { PageHeader, ErrorNotice, Loading, Empty, Success, Modal } from '../components/UI';
import type { Product } from '../types';

export default function Products() {
  const { token } = useAuth();
  const { data, error, loading, reload } = useResource<Product[]>('/produtos', token);
  const [search, setSearch] = useState(''),
    [active, setActive] = useState(''),
    [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [mutationError, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState('');
  const lock = useRef(false);
  const selected = editing && editing !== 'new' ? editing : null;
  const products = data?.filter(
    (p) =>
      p.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) &&
      (!active || String(p.ativo) === active),
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const preco = parsePrice(String(form.get('preco')));
    const nome = String(form.get('nome')).trim();
    if (!nome || !Number.isFinite(preco) || preco < 0 || preco > 9999999.99) {
      setError(new ApiError('Informe o nome e um preço válido, com até duas casas decimais.'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await api(selected ? `/produtos/${selected.id}` : '/produtos', {
        method: selected ? 'PUT' : 'POST',
        token,
        body: {
          nome,
          descricao: String(form.get('descricao')).trim() || null,
          preco,
          ativo: form.get('ativo') === 'on',
          ...(!selected && { quantidade_disponivel: Number(form.get('quantidade')) }),
        },
      });
      setEditing(null);
      setSuccess(selected ? 'Produto atualizado.' : 'Produto cadastrado.');
      reload();
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function open(product: Product | 'new') {
    setError(null);
    setEditing(product);
  }
  return (
    <>
      <PageHeader
        eyebrow="CUIDE DO SEU CARDÁPIO"
        title="Produtos"
        description="Organize os doces, preços e disponibilidade para os clientes."
        action={
          <button className="button button-primary" onClick={() => open('new')}>
            <Plus size={18} />
            Novo produto
          </button>
        }
      />
      {success && <Success>{success}</Success>}
      <section className="panel">
        <div className="filters">
          <label className="filter-search">
            Buscar produto
            <input
              placeholder="Nome do doce"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Disponibilidade
            <select value={active} onChange={(e) => setActive(e.target.value)}>
              <option value="">Todos os produtos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </label>
        </div>
        <ErrorNotice error={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : (
          products &&
          (products.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Preço</th>
                    <th>Estoque</th>
                    <th>Disponibilidade</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nome}</strong>
                        <small className="product-description">
                          {p.descricao || 'Sem descrição'}
                        </small>
                      </td>
                      <td>{money(p.preco)}</td>
                      <td>{p.quantidade_disponivel} un.</td>
                      <td>
                        <span
                          className={`status ${p.ativo ? 'status-confirmado' : 'status-cancelado'}`}
                        >
                          <i />
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => open(p)}
                          aria-label={`Editar ${p.nome}`}
                        >
                          <Pencil size={15} />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Nenhum produto encontrado">Cadastre um doce ou ajuste os filtros.</Empty>
          ))
        )}
      </section>
      {editing && (
        <Modal
          title={selected ? 'Editar produto' : 'Novo produto'}
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <label>
                Nome do produto
                <input name="nome" required maxLength={120} defaultValue={selected?.nome} />
              </label>
              <label>
                Descrição <span className="optional">(opcional)</span>
                <textarea
                  name="descricao"
                  maxLength={2000}
                  rows={3}
                  defaultValue={selected?.descricao || ''}
                />
              </label>
              <div className="form-grid">
                <label>
                  Preço por unidade (R$)
                  <input
                    name="preco"
                    inputMode="decimal"
                    required
                    placeholder="0,00"
                    defaultValue={selected?.preco.toFixed(2).replace('.', ',')}
                  />
                </label>
                {!selected && (
                  <label>
                    Estoque inicial
                    <input
                      name="quantidade"
                      type="number"
                      min="0"
                      max="1000000"
                      step="1"
                      required
                      defaultValue="0"
                    />
                  </label>
                )}
              </div>
              <label className="checkbox-label">
                <input
                  name="ativo"
                  type="checkbox"
                  defaultChecked={selected ? selected.ativo : true}
                />
                Disponível no cardápio
              </label>
              <p className="field-hint">
                Produtos inativos deixam de aparecer para novos pedidos. O histórico das encomendas
                é mantido.
              </p>
              {selected && (
                <p className="field-hint">Para alterar quantidades, utilize a página Estoque.</p>
              )}
            </fieldset>
            <ErrorNotice error={mutationError} />
            <div className="form-actions">
              <button
                type="button"
                className="button button-quiet"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar produto'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
