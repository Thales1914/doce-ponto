import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type CartItem = { id: number; quantity: number };
const KEY = 'doceponto.cart.v1';
export function sanitizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const entries = new Map<number, CartItem>();
  for (const item of value) {
    if (
      item &&
      Number.isInteger(item.id) &&
      item.id > 0 &&
      item.id <= 2147483647 &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 1000
    ) {
      if (entries.has(item.id) || entries.size < 50)
        entries.set(item.id, { id: item.id, quantity: item.quantity });
    }
  }
  return [...entries.values()];
}
function loadCart() {
  try {
    return sanitizeCart(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return [];
  }
}
type Cart = {
  items: CartItem[];
  setQuantity: (id: number, quantity: number) => void;
  add: (id: number) => void;
  clear: () => void;
  count: number;
};
const Context = createContext<Cart | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState(loadCart);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* carrinho segue disponível em memória */
    }
  }, [items]);
  const setQuantity = (id: number, quantity: number) =>
    setItems((old) =>
      quantity <= 0
        ? old.filter((x) => x.id !== id)
        : sanitizeCart([...old.filter((x) => x.id !== id), { id, quantity }]),
    );
  const add = (id: number) =>
    setItems((old) => {
      const item = old.find((x) => x.id === id);
      if (item)
        return old.map((x) =>
          x.id === id ? { ...x, quantity: Math.min(1000, x.quantity + 1) } : x,
        );
      return old.length < 50 ? [...old, { id, quantity: 1 }] : old;
    });
  return (
    <Context.Provider
      value={{
        items,
        setQuantity,
        add,
        clear: () => setItems([]),
        count: items.reduce((n, x) => n + x.quantity, 0),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCart() {
  const value = useContext(Context);
  if (!value) throw new Error('CartProvider ausente');
  return value;
}
