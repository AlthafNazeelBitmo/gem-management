export type Row = Record<string, unknown>;
export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  csrf: string;
};
export type Workspace = {
  settings: Row;
  aiConfigured: boolean;
  mfaEnabled: boolean;
} & Record<string, unknown>;
export const str = (r: Row, key: string) => String(r[key] ?? "");
export const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]) : [];
export const list = (w: Workspace | null, key: string): Row[] => rows(w?.[key]);
export const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function request<T = Row>(
  url: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(url, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      ...(!multipart && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(body !== undefined ? { "X-CSRF-Token": csrf } : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Request failed. Please try again.");
  return result;
}
