import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const code = 'PED-ABCDEFGH';
const order = {
  numero_pedido: code,
  status: 'confirmado',
  status_descricao: 'Pedido confirmado',
  criado_em: '2026-10-25T12:00:00Z',
  atualizado_em: '2026-10-25T13:00:00Z',
  total: 7,
  itens: [{ produto_id: 1, produto_nome: 'Brigadeiro', quantidade: 2, subtotal: 7 }],
  observacoes: null,
  observacoes_adicionais: [],
  historico: [
    { status: 'confirmado', status_descricao: 'Pedido confirmado', data: '2026-10-25T13:00:00Z' },
  ],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const mount = (route = '/acompanhar') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );

describe('Acompanhamento público', () => {
  it('valida e normaliza o código, envia observação e consulta as atualizações', async () => {
    const user = userEvent.setup();
    const notes: { texto: string; criado_em: string }[] = [];
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(options.headers).not.toHaveProperty('Authorization');
      if (url.endsWith('/observacoes')) {
        const { texto } = JSON.parse(String(options.body));
        notes.push({ texto, criado_em: '2026-10-25T14:00:00Z' });
        return json(notes[0], 201);
      }
      return json({ ...order, observacoes_adicionais: notes });
    });
    vi.stubGlobal('fetch', fetchMock);
    mount();
    await user.type(await screen.findByLabelText('Código do pedido'), 'inválido');
    await user.click(screen.getByRole('button', { name: 'Consultar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira o código');
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Código do pedido'));
    await user.type(screen.getByLabelText('Código do pedido'), ' ped-abcdefgh ');
    await user.click(screen.getByRole('button', { name: 'Consultar pedido' }));
    expect(await screen.findByRole('heading', { name: code })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nova observação'), '  Retirada à tarde  ');
    await user.click(screen.getByRole('button', { name: 'Enviar observação' }));
    expect(await screen.findByText('Observação enviada para a equipe.')).toBeInTheDocument();
    expect(await screen.findByText('Retirada à tarde')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Nova observação')).toHaveValue(''));
    expect(notes[0].texto).toBe('Retirada à tarde');
  });
  it('exibe erro de consulta e permite tentar novamente', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ erro: { mensagem: 'Pedido não encontrado.' } }, 404))
        .mockResolvedValue(json(order)),
    );
    const user = userEvent.setup();
    mount('/acompanhar/' + code);
    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: code })).toBeInTheDocument();
  });
  it('preserva a observação quando o servidor recusa e impede envio após encerramento', async () => {
    let closed = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) =>
        options.method === 'POST'
          ? json(
              {
                erro: { mensagem: 'Pedido finalizado: não é possível incluir novas observações.' },
              },
              409,
            )
          : json({ ...order, status: closed ? 'entregue' : order.status }),
      ),
    );
    const user = userEvent.setup();
    mount('/acompanhar/' + code);
    await user.type(await screen.findByLabelText('Nova observação'), 'Minha orientação');
    await user.click(screen.getByRole('button', { name: 'Enviar observação' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido finalizado');
    expect(screen.getByLabelText('Nova observação')).toHaveValue('Minha orientação');
    closed = true;
    await user.click(screen.getByRole('button', { name: 'Atualizar andamento' }));
    expect(await screen.findByText(/Este pedido foi encerrado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar observação' })).not.toBeInTheDocument();
  });
});
