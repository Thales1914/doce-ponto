import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
type State<T> = { data: T | null; error: unknown; loading: boolean };
export function useResource<T>(path: string, token?: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const loaded = useRef('');
  useEffect(() => {
    const key = `${token ?? ''}\n${path}`;
    // Recarregar o mesmo endereço mantém os dados na tela até a resposta chegar,
    // evitando que listas e o acompanhamento do pedido pisquem a cada atualização.
    const refresh = loaded.current === key;
    const controller = new AbortController();
    if (!refresh) setState({ data: null, error: null, loading: true });
    api<T>(path, { token, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        loaded.current = key;
        setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        loaded.current = '';
        setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, [path, token, revision]);
  return { ...state, reload };
}
