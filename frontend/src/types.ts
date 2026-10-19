export type Product = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  quantidade_disponivel: number;
  ativo: boolean;
};
export type Admin = { id: number; nome: string; email: string };
export type OrderStatus =
  'solicitado' | 'confirmado' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado';
export type OrderItem = {
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};
export type OrderSummary = {
  id: number;
  numero_pedido: string;
  status: OrderStatus;
  cliente_nome: string;
  cliente_contato: string;
  total: number;
  quantidade_itens: number;
  criado_em: string;
};
export type OrderDetail = OrderSummary & {
  cliente: { nome: string; contato: string };
  itens: OrderItem[];
  observacoes: string | null;
  historico: {
    status_anterior: OrderStatus | null;
    status_novo: OrderStatus;
    observacao: string | null;
    admin_nome: string | null;
    criado_em: string;
  }[];
  observacoes_adicionais: { texto: string; criado_em: string }[];
};
export type Receipt = {
  numero_pedido: string;
  total: number;
  itens: OrderItem[];
  criado_em: string;
};
export type Movement = {
  id: number;
  produto_id: number;
  produto_nome: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  motivo: string | null;
  criado_em: string;
};
export type Page<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; total_paginas: number };
};
export type Tracking = {
  numero_pedido: string;
  status: OrderStatus;
  status_descricao: string;
  criado_em: string;
  atualizado_em: string;
  itens: OrderItem[];
  total: number;
  observacoes: string | null;
  observacoes_adicionais: { texto: string; criado_em: string }[];
  historico: { status: OrderStatus; status_descricao: string; data: string }[];
};
export type Restaurant = { id: number; nome: string; contato: string | null; criado_em: string };
export type PaymentStatus = 'pendente' | 'recebido';
export type EntryStatus = PaymentStatus | 'cancelado';
export type Sale = {
  id: number;
  restaurante_id: number;
  restaurante_nome: string;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  valor_total: number;
  status_pagamento: PaymentStatus;
  criado_em: string;
};
export type Entry = {
  id: number;
  pedido_id: number | null;
  numero_pedido: string | null;
  venda_restaurante_id: number | null;
  restaurante_nome: string | null;
  descricao: string | null;
  valor: number;
  forma: string | null;
  status: EntryStatus;
  data: string;
  criado_em: string;
  origem: 'pedido' | 'venda_restaurante' | 'manual';
};
export type Expense = {
  id: number;
  descricao: string;
  categoria: string | null;
  valor: number;
  data: string;
  criado_em: string;
};
type Count = { quantidade: number; valor: number };
export type DashboardSummary = {
  periodo: { inicio: string; fim: string };
  vendas: {
    total: number;
    pedidos: Count;
    restaurantes: Count;
    por_dia: { data: string; valor: number }[];
  };
  recebimentos: Count;
  pendencias: {
    total: number;
    quantidade: number;
    por_origem: { pedidos: Count; restaurantes: Count; manual: Count };
  };
  despesas: Count;
  saldo_periodo: number;
  estoque: {
    total_unidades: number;
    produtos: { id: number; nome: string; quantidade_disponivel: number }[];
  };
  pedidos_por_status: Record<OrderStatus, number>;
};
