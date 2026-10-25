import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { SESSION_KEY } from '../lib/api';
import type { DashboardSummary } from '../types';

const summary: DashboardSummary = {
  periodo: { inicio: '2026-10-01', fim: '2026-10-25' },
  vendas: {
    total: 100,
    pedidos: { quantidade: 1, valor: 40 },
    restaurantes: { quantidade: 1, valor: 60 },
    por_dia: [{ data: '2026-10-20', valor: 100 }],
  },
  recebimentos: { quantidade: 1, valor: 60 },
  despesas: { quantidade: 1, valor: 15 },
  saldo_periodo: 45,
  pendencias: {
    total: 40,
    quantidade: 1,
    por_origem: {
      pedidos: { quantidade: 1, valor: 40 },
      restaurantes: { quantidade: 0, valor: 0 },
      manual: { quantidade: 0, valor: 0 },
    },
  },
  estoque: {
    total_unidades: 8,
    produtos: [{ id: 1, nome: 'Brigadeiro', quantidade_disponivel: 8 }],
  },
  pedidos_por_status: {
    solicitado: 0,
    confirmado: 1,
    em_producao: 0,
    pronto: 0,
    entregue: 0,
    cancelado: 0,
  },
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function mount() {
  sessionStorage.setItem(SESSION_KEY, 'token-teste');
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <App />
    </MemoryRouter>,
  );
}
describe('Dashboard', () => {
  it('separa valores do período das posições atuais e aplica o filtro', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth/me')
        ? json({ id: 1, nome: 'Admin', email: 'admin@teste.local' })
        : json(summary),
    );
    vi.stubGlobal('fetch', fetchMock);
    mount();
    expect(await screen.findByRole('article', { name: 'Vendas no período' })).toHaveTextContent(
      '100,00',
    );
    expect(screen.getByRole('article', { name: 'Saldo do período' })).toHaveTextContent('45,00');
    expect(screen.getByRole('article', { name: 'Pendente atualmente' })).toHaveTextContent(
      'independentemente do período',
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Data inicial'), '2026-10-21');
    await user.type(screen.getByLabelText('Data final'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('inicial anterior ou igual');
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('inicio='))).toHaveLength(0);
    await user.clear(screen.getByLabelText('Data final'));
    await user.type(screen.getByLabelText('Data final'), '2026-10-25');
    await user.click(screen.getByRole('button', { name: 'Aplicar período' }));
    await screen.findByRole('article', { name: 'Saldo do período' });
    expect(
      fetchMock.mock.calls.some(([url]) => url.includes('inicio=2026-10-21&fim=2026-10-25')),
    ).toBe(true);
  });
  it('permite recuperar falha e exibe estado sem vendas, sem inventar movimentos', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/me'))
          return json({ id: 1, nome: 'Admin', email: 'admin@teste.local' });
        if (attempts++ === 0) return json({ erro: { mensagem: 'Serviço indisponível.' } }, 503);
        return json({ ...summary, vendas: { ...summary.vendas, total: 0, por_dia: [] } });
      }),
    );
    mount();
    const user = userEvent.setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Sem vendas no período')).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Vendas no período' })).getByText(/0,00/),
    ).toBeInTheDocument();
  });
});
