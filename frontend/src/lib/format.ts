import type { OrderStatus } from '../types';
export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
export const statusLabels: Record<OrderStatus, string> = {
  solicitado: 'Solicitado',
  confirmado: 'Confirmado',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
export const transitions: Record<OrderStatus, OrderStatus[]> = {
  solicitado: ['confirmado', 'cancelado'],
  confirmado: ['em_producao', 'cancelado'],
  em_producao: ['pronto', 'cancelado'],
  pronto: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};
export function parsePrice(input: string) {
  const normalized = input.trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}
export const dateOnly = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
export const today = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
export const paymentLabels = {
  pendente: 'A receber',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};
export const originLabels = {
  pedido: 'Pedido de cliente',
  venda_restaurante: 'Venda a restaurante',
  manual: 'Lançamento manual',
};
export const paymentMethods = [
  'Pix',
  'Dinheiro',
  'Cartão de crédito',
  'Cartão de débito',
  'Transferência',
];
