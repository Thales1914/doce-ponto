export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public details: { campo: string; mensagem: string }[] = [],
  ) {
    super(message);
  }
}
export const SESSION_KEY = 'doceponto.admin.session';
export const SESSION_EXPIRED = 'doceponto:session-expired';
type Options = { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}${path}`,
      {
        method: options.method || 'GET',
        signal: options.signal,
        headers: {
          ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
          ...(options.token && { Authorization: `Bearer ${options.token}` }),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && options.token)
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED, { detail: options.token }));
    throw new ApiError(
      data?.erro?.mensagem || 'Não foi possível concluir a solicitação. Tente novamente.',
      response.status,
      data?.erro?.detalhes || [],
    );
  }
  if (data === null)
    throw new ApiError('O serviço retornou uma resposta inesperada. Tente novamente.');
  return data as T;
}
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return `?${params}`;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.';
