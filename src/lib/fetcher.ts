export class FetchError extends Error {
  status: number;
  body: Record<string, unknown> | null;

  constructor(status: number, message: string, body: Record<string, unknown> | null = null) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.body = body;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let body: Record<string, unknown> | null = null;
    let message = `Request failed with status ${res.status}`;
    try {
      body = await res.json();
      if (body && typeof body === 'object' && 'error' in body) {
        message = String(body.error);
      }
    } catch {
      const text = await res.text().catch(() => '');
      if (text) message = text;
    }
    throw new FetchError(res.status, message, body);
  }
  return res.json() as Promise<T>;
}
