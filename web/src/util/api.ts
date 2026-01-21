export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  get: <T>(path: string) => request(path) as Promise<T>,
  post: <T>(path: string, body: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(body) }) as Promise<T>,
  put: <T>(path: string, body: unknown) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }) as Promise<T>,
  delete: <T>(path: string) => request(path, { method: "DELETE" }) as Promise<T>,
  isAuthError: (err: unknown) => err instanceof AuthError
};

