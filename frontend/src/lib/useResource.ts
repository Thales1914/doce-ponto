import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
export function useResource<T>(path: string, token?: string | null) {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    api<T>(path, { token, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, [path, token, revision]);
  return { ...state, reload };
}
