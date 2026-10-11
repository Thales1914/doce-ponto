import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Executar somente contra tests/frontend-server.js (banco efêmero exclusivo de QA).
describe.skipIf(!process.env.FRONTEND_LIVE_TEST)(
  'Interface integrada à API e ao PostgreSQL de QA',
  () => {
    it('cliente solicita; administração confirma, cancela, edita produtos e movimenta estoque', async () => {
      vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:3100/api');
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );
      await user.click(
        await screen.findByRole('button', { name: 'Adicionar Brigadeiro tradicional' }),
      );
      await user.click(screen.getByRole('button', { name: 'Adicionar Brigadeiro tradicional' }));
      await user.click(screen.getByRole('link', { name: /Revisar pedido/ }));
      await user.type(await screen.findByLabelText('Seu nome'), 'Cliente QA Interface');
      await user.type(screen.getByLabelText('Telefone ou e-mail'), '11988887777');
      await user.type(screen.getByLabelText(/Observações/), 'Teste de integração da interface.');
      await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      expect(
        await screen.findByRole('heading', { name: 'Seu pedido foi recebido!' }),
      ).toBeInTheDocument();
      const code = screen.getByText(/^PED-[A-Z0-9]+$/).textContent!;
      await user.click(screen.getByRole('link', { name: /Área administrativa/ }));
      await user.type(await screen.findByLabelText('E-mail'), 'admin@teste.local');
      await user.type(screen.getByLabelText('Senha'), 'senha-de-teste');
      await user.click(screen.getByRole('button', { name: 'Entrar no painel' }));
      await user.click(await screen.findByRole('link', { name: `Ver pedido ${code}` }));
      await screen.findByRole('heading', { name: code });
      expect(await screen.findByText('Cliente QA Interface')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Atualizar status' }));
      expect(await screen.findByText('Status do pedido atualizado.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText('Novo status')).toHaveValue('em_producao'));
      await user.click(screen.getByRole('link', { name: 'Estoque' }));
      const productSelect = (await screen.findAllByLabelText('Produto'))[0];
      await waitFor(() => expect(productSelect).toBeEnabled());
      await user.selectOptions(productSelect, '1');
      expect(
        await screen.findByText('38 unidades', { selector: '.balance-preview strong' }),
      ).toBeInTheDocument();
      await user.selectOptions(
        screen.getByLabelText('Tipo', { selector: '.stock-grid select' }),
        'saida',
      );
      await user.type(screen.getByLabelText('Quantidade'), '99');
      await user.click(screen.getByRole('button', { name: 'Registrar movimentação' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('O saldo não pode ficar negativo');
      await user.selectOptions(
        screen.getByLabelText('Tipo', { selector: '.stock-grid select' }),
        'entrada',
      );
      await user.clear(screen.getByLabelText('Quantidade'));
      await user.type(screen.getByLabelText('Quantidade'), '5');
      await user.click(screen.getByRole('button', { name: 'Registrar movimentação' }));
      expect(
        await screen.findByText('Movimentação registrada. Saldo atualizado.'),
      ).toBeInTheDocument();
      expect(
        await screen.findByText('43 unidades', { selector: '.balance-preview strong' }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Pedidos' }));
      await user.click(await screen.findByRole('link', { name: `Ver pedido ${code}` }));
      await user.selectOptions(await screen.findByLabelText('Novo status'), 'cancelado');
      await user.click(screen.getByRole('button', { name: 'Atualizar status' }));
      await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
      expect(await screen.findByText('Este pedido foi encerrado.')).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Estoque' }));
      await waitFor(() => expect(screen.getAllByLabelText('Produto')[0]).toBeEnabled());
      await user.selectOptions(screen.getAllByLabelText('Produto')[0], '1');
      expect(
        await screen.findByText('45 unidades', { selector: '.balance-preview strong' }),
      ).toBeInTheDocument();
      await user.selectOptions(
        screen.getByLabelText('Tipo', { selector: '.stock-grid select' }),
        'ajuste',
      );
      await user.type(screen.getByLabelText('Novo saldo'), '40');
      await user.type(screen.getByLabelText('Motivo'), 'Conferência de QA');
      await user.click(screen.getByRole('button', { name: 'Registrar movimentação' }));
      expect(
        await screen.findByText('40 unidades', { selector: '.balance-preview strong' }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Produtos' }));
      await user.click(await screen.findByRole('button', { name: 'Novo produto' }));
      const dialog = screen.getByRole('dialog');
      await user.type(within(dialog).getByLabelText('Nome do produto'), 'Doce QA');
      await user.type(within(dialog).getByLabelText('Preço por unidade (R$)'), '6,25');
      await user.click(within(dialog).getByRole('button', { name: 'Salvar produto' }));
      expect(await screen.findByText('Produto cadastrado.')).toBeInTheDocument();
      await user.click(await screen.findByRole('button', { name: 'Editar Doce QA' }));
      await user.click(screen.getByLabelText('Disponível no cardápio'));
      await user.click(screen.getByRole('button', { name: 'Salvar produto' }));
      expect(await screen.findByText('Produto atualizado.')).toBeInTheDocument();
      expect(await screen.findByText('Inativo')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
      expect(
        await screen.findByRole('heading', { name: 'Vamos cuidar dos pedidos?' }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Voltar ao cardápio' }));
      expect(
        await screen.findByRole('button', { name: 'Adicionar Brigadeiro tradicional' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Doce QA')).not.toBeInTheDocument();
    }, 60000);
  },
);
