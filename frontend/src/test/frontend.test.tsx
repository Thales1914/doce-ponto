import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { api, SESSION_EXPIRED, SESSION_KEY } from '../lib/api';
import { sanitizeCart } from '../context/Cart';

const product = {
  id: 1,
  nome: 'Brigadeiro',
  descricao: 'Chocolate',
  preco: 3.5,
  quantidade_disponivel: 20,
  ativo: true,
};
const admin = { id: 1, nome: 'Admin Teste', email: 'admin@teste.local' };
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Fluxos do frontend', () => {
  it('envia as quantidades do carrinho, exibe o código real e limpa a seleção', async () => {
    const user = userEvent.setup();
    let submitted: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url === '/api/produtos') return json([product]);
        if (url === '/api/pedidos' && options.method === 'POST') {
          submitted = JSON.parse(String(options.body));
          return json({ numero_pedido: 'PED-TESTE123' }, 201);
        }
        if (url === '/api/pedidos/PED-TESTE123')
          return json({
            numero_pedido: 'PED-TESTE123',
            total: 7,
            itens: [{ produto_id: 1, produto_nome: 'Brigadeiro', quantidade: 2, subtotal: 7 }],
          });
        throw new Error(`Rota inesperada: ${url}`);
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Adicionar Brigadeiro' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar Brigadeiro' }));
    await user.click(screen.getByRole('link', { name: /Revisar pedido/ }));
    await user.type(await screen.findByLabelText('Seu nome'), 'Cliente Teste');
    await user.type(screen.getByLabelText('Telefone ou e-mail'), '11999999999');
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(
      await screen.findByRole('heading', { name: 'Seu pedido foi recebido!' }),
    ).toBeInTheDocument();
    expect(screen.getByText('PED-TESTE123')).toBeInTheDocument();
    expect(submitted).toEqual({
      cliente: { nome: 'Cliente Teste', contato: '11999999999' },
      itens: [{ produto_id: 1, quantidade: 2 }],
      observacoes: null,
    });
    expect(JSON.parse(localStorage.getItem('doceponto.cart.v1')!)).toEqual([]);
  });
  it('mantém os dados do cliente e o carrinho após rejeição do backend', async () => {
    const user = userEvent.setup();
    localStorage.setItem('doceponto.cart.v1', JSON.stringify([{ id: 1, quantity: 1 }]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/produtos'
          ? json([product])
          : json({ erro: { mensagem: 'Contato inválido.' } }, 400),
      ),
    );
    mount('/pedido');
    await user.type(await screen.findByLabelText('Seu nome'), 'Ana Silva');
    await user.type(screen.getByLabelText('Telefone ou e-mail'), 'invalido');
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Contato inválido.');
    await waitFor(() => expect(screen.getByLabelText('Seu nome')).toHaveValue('Ana Silva'));
    expect(screen.getByLabelText('Telefone ou e-mail')).toHaveValue('invalido');
    expect(JSON.parse(localStorage.getItem('doceponto.cart.v1')!)).toHaveLength(1);
  });
  it('bloqueia envio de item removido do cardápio', async () => {
    localStorage.setItem('doceponto.cart.v1', JSON.stringify([{ id: 99, quantity: 1 }]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([])),
    );
    mount('/pedido');
    expect(await screen.findByRole('alert')).toHaveTextContent('Um produto ficou indisponível');
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
  });
  it('redireciona acesso administrativo sem sessão ao login', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount('/admin/estoque');
    expect(
      await screen.findByRole('heading', { name: 'Vamos cuidar dos pedidos?' }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('encerra sessão rejeitada pela API e exibe o login', async () => {
    sessionStorage.setItem(SESSION_KEY, 'expired');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ erro: { mensagem: 'Token expirado.' } }, 401)),
    );
    mount('/admin/pedidos');
    expect(
      await screen.findByRole('heading', { name: 'Vamos cuidar dos pedidos?' }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('registra entrada sem motivo omitindo esse campo opcional', async () => {
    const user = userEvent.setup();
    let submitted: unknown;
    sessionStorage.setItem(SESSION_KEY, 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith('/auth/me')) return json(admin);
        if (url.endsWith('/produtos')) return json([product]);
        if (url.includes('/estoque/movimentacoes'))
          return json({ data: [], meta: { page: 1, limit: 15, total: 0, total_paginas: 0 } });
        if (url.endsWith('/estoque/movimentacao')) {
          submitted = JSON.parse(String(options.body));
          return json({});
        }
        throw new Error(url);
      }),
    );
    mount('/admin/estoque');
    const selects = await screen.findAllByLabelText('Produto');
    await waitFor(() => expect(selects[0]).toBeEnabled());
    await user.selectOptions(selects[0], '1');
    await user.type(screen.getByLabelText('Quantidade'), '5');
    await user.click(screen.getByRole('button', { name: 'Registrar movimentação' }));
    expect(
      await screen.findByText('Movimentação registrada. Saldo atualizado.'),
    ).toBeInTheDocument();
    expect(submitted).toEqual({ produto_id: 1, tipo: 'entrada', quantidade: 5 });
  });
  it('mostra o conflito de estoque sem avançar o status do pedido', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(SESSION_KEY, 'token');
    const order = {
      id: 1,
      numero_pedido: 'PED-TESTE123',
      status: 'solicitado',
      criado_em: '2026-10-11T12:00:00Z',
      cliente: { nome: 'Ana', contato: 'ana@exemplo.com' },
      itens: [],
      total: 0,
      historico: [],
      observacoes_adicionais: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/me')
          ? json(admin)
          : url.endsWith('/status')
            ? json({ erro: { mensagem: 'Estoque insuficiente.' } }, 409)
            : json(order),
      ),
    );
    mount('/admin/pedidos/1');
    await user.click(await screen.findByRole('button', { name: 'Atualizar status' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Estoque insuficiente.');
    expect(screen.getByText('Solicitado')).toBeInTheDocument();
  });
});
describe('Limites e autenticação HTTP', () => {
  it('descarta dados inválidos do carrinho armazenado e limita a 50 produtos', () => {
    expect(
      sanitizeCart([
        { id: 1, quantity: 2 },
        { id: 1, quantity: 4 },
        { id: -1, quantity: 1 },
        { id: 2, quantity: 1001 },
        null,
      ]),
    ).toEqual([{ id: 1, quantity: 4 }]);
    expect(
      sanitizeCart(Array.from({ length: 60 }, (_, i) => ({ id: i + 1, quantity: 1 }))),
    ).toHaveLength(50);
  });
  it('não envia token em pedidos públicos e não encerra sessão por erro de login', async () => {
    const event = vi.fn();
    window.addEventListener(SESSION_EXPIRED, event);
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) =>
      json({ erro: { mensagem: 'Credenciais inválidas.' } }, 401),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      api('/auth/login', { method: 'POST', body: { email: 'teste', senha: 'errada' } }),
    ).rejects.toThrow('Credenciais inválidas.');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(event).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED, event);
  });
});
describe('Gestão comercial e financeira', () => {
  const page = (data: unknown[], extra = {}) => ({
    data,
    meta: { page: 1, limit: 15, total: data.length, total_paginas: 1 },
    ...extra,
  });
  it('registra venda a restaurante com o valor do cardápio quando nenhum valor é informado', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(SESSION_KEY, 'token');
    let submitted: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith('/auth/me')) return json(admin);
        if (url.endsWith('/restaurantes')) return json([{ id: 7, nome: 'Café Central' }]);
        if (url.endsWith('/produtos')) return json([product]);
        if (url === '/api/vendas-restaurantes' && options.method === 'POST') {
          submitted = JSON.parse(String(options.body));
          return json({ id: 1 }, 201);
        }
        if (url.startsWith('/api/vendas-restaurantes')) return json(page([]));
        throw new Error(url);
      }),
    );
    mount('/admin/vendas');
    await user.click(await screen.findByRole('button', { name: 'Nova venda' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Restaurante')).toBeEnabled());
    await user.selectOptions(within(dialog).getByLabelText('Restaurante'), '7');
    await user.selectOptions(within(dialog).getByLabelText('Produto vendido'), '1');
    await user.type(within(dialog).getByLabelText('Quantidade'), '4');
    expect(within(dialog).getByText(/preço do cardápio: R\$\s14,00/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Registrar venda' }));
    expect(await screen.findByText(/Venda registrada/)).toBeInTheDocument();
    expect(submitted).toEqual({ restaurante_id: 7, produto_id: 1, quantidade: 4 });
  });
  it('impede vender mais do que o estoque disponível sem chamar a API', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(SESSION_KEY, 'token');
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/auth/me')) return json(admin);
      if (url.endsWith('/restaurantes')) return json([{ id: 7, nome: 'Café Central' }]);
      if (url.endsWith('/produtos')) return json([product]);
      if (options.method === 'POST') throw new Error('não deveria enviar');
      return json(page([]));
    });
    vi.stubGlobal('fetch', fetchMock);
    mount('/admin/vendas');
    await user.click(await screen.findByRole('button', { name: 'Nova venda' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Restaurante')).toBeEnabled());
    await user.selectOptions(within(dialog).getByLabelText('Restaurante'), '7');
    await user.selectOptions(within(dialog).getByLabelText('Produto vendido'), '1');
    await user.type(within(dialog).getByLabelText('Quantidade'), '21');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar venda' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Estoque insuficiente');
  });
  it('registra o recebimento de uma entrada pendente com forma e data', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(SESSION_KEY, 'token');
    let submitted: unknown;
    const entry = {
      id: 3,
      pedido_id: 9,
      numero_pedido: 'PED-ABCDEFGH',
      descricao: 'Pedido PED-ABCDEFGH',
      valor: 21,
      forma: null,
      status: 'pendente',
      data: '2026-10-10',
      origem: 'pedido',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith('/auth/me')) return json(admin);
        if (url === '/api/financeiro/entradas/3/status') {
          submitted = JSON.parse(String(options.body));
          return json({ ...entry, status: 'recebido' });
        }
        if (url.startsWith('/api/financeiro/entradas'))
          return json(page([entry], { totais: { recebido: 0, pendente: 21, cancelado: 0 } }));
        throw new Error(url);
      }),
    );
    mount('/admin/financeiro');
    expect(await screen.findByText('10/10/2026')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Registrar recebimento de Pedido PED-ABCDEFGH' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Forma de pagamento/), 'Pix');
    await user.clear(within(dialog).getByLabelText('Data do recebimento'));
    await user.type(within(dialog).getByLabelText('Data do recebimento'), '2026-10-12');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));
    expect(await screen.findByText('Recebimento registrado.')).toBeInTheDocument();
    expect(submitted).toEqual({ status: 'recebido', forma: 'Pix', data: '2026-10-12' });
  });
  it('mostra o resumo do período e completa os dias sem venda no gráfico', async () => {
    sessionStorage.setItem(SESSION_KEY, 'token');
    const count = (quantidade: number, valor: number) => ({ quantidade, valor });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/me')) return json(admin);
        if (url.startsWith('/api/dashboard/resumo'))
          return json({
            periodo: { inicio: '2026-10-01', fim: '2026-10-05' },
            vendas: {
              total: 150,
              pedidos: count(2, 50),
              restaurantes: count(1, 100),
              por_dia: [
                { data: '2026-10-02', valor: 50 },
                { data: '2026-10-04', valor: 100 },
              ],
            },
            recebimentos: count(1, 100),
            pendencias: {
              total: 50,
              quantidade: 2,
              por_origem: { pedidos: count(2, 50), restaurantes: count(0, 0), manual: count(0, 0) },
            },
            despesas: count(1, 130),
            saldo_periodo: -30,
            estoque: {
              total_unidades: 3,
              produtos: [{ id: 1, nome: 'Brigadeiro', quantidade_disponivel: 3 }],
            },
            pedidos_por_status: {
              solicitado: 1,
              confirmado: 1,
              em_producao: 0,
              pronto: 0,
              entregue: 0,
              cancelado: 0,
            },
          });
        throw new Error(url);
      }),
    );
    mount('/admin/visao-geral');
    expect(await screen.findByText('De 01/10/2026 a 05/10/2026.')).toBeInTheDocument();
    expect(screen.getByText('-R$ 30,00')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { name: /\/10\/2026/ })).toHaveLength(5);
    expect(screen.getByRole('listitem', { name: /^03\/10\/2026: R\$\s0,00$/ })).toBeInTheDocument();
    expect(screen.getByText('Brigadeiro')).toBeInTheDocument();
  });
  it('acompanha o pedido pelo código e envia observação sem token', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(SESSION_KEY, 'token-admin');
    let request: RequestInit | undefined;
    const tracking = {
      numero_pedido: 'PED-ABCDEFGH',
      status: 'em_producao',
      status_descricao: 'Em produção',
      criado_em: '2026-10-11T12:00:00Z',
      atualizado_em: '2026-10-11T13:00:00Z',
      itens: [{ produto_id: 1, produto_nome: 'Brigadeiro', quantidade: 2, subtotal: 7 }],
      total: 7,
      observacoes: null,
      observacoes_adicionais: [],
      historico: [
        { status: 'solicitado', status_descricao: 'Pedido recebido', data: '2026-10-11T12:00:00Z' },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url === '/api/pedidos/PED-ABCDEFGH/observacoes') {
          request = options;
          return json({ texto: 'Retiro às 17h', criado_em: '2026-10-11T14:00:00Z' }, 201);
        }
        if (url === '/api/pedidos/PED-ABCDEFGH') return json(tracking);
        throw new Error(url);
      }),
    );
    mount('/acompanhar');
    await user.type(await screen.findByLabelText('Número do pedido'), 'ped-abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Acompanhar' }));
    expect(await screen.findByRole('heading', { name: 'PED-ABCDEFGH' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Em produção');
    await user.type(screen.getByLabelText('Adicionar observação'), 'Retiro às 17h');
    await user.click(screen.getByRole('button', { name: 'Enviar observação' }));
    expect(await screen.findByText('Observação enviada para a equipe.')).toBeInTheDocument();
    expect(JSON.parse(String(request!.body))).toEqual({ texto: 'Retiro às 17h' });
    expect(request!.headers).not.toHaveProperty('Authorization');
  });
  it('recusa código de pedido em formato inválido antes de consultar', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount('/acompanhar');
    await user.type(await screen.findByLabelText('Número do pedido'), 'PED-123');
    await user.click(screen.getByRole('button', { name: 'Acompanhar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('PED-XXXXXXXX');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
