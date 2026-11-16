/// <reference types="vite/client" />
import { createRealtimeClient, nodePostgresParsers } from "@neon/realtime/client";

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
// Keep the same reference only for identical commands whose outcome was not confirmed.
const uncertainCommands = new Map<string, { id: string; expires: number }>();
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly field?: string) {
    super(message);
  }
}
export function setCsrf(value: string) {
  if (csrf !== value) uncertainCommands.clear();
  csrf = value;
}
export async function request<T = Row>(
  url: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const multipart = body instanceof FormData;
  const payload = body === undefined ? undefined : multipart ? body : JSON.stringify(body);
  const track = url.startsWith("/api/commands/") && typeof payload === "string" && !method;
  const identity = track ? JSON.stringify([url, payload]) : "";
  const time = Date.now();
  for (const [key, entry] of uncertainCommands) {
    if (entry.expires <= time) uncertainCommands.delete(key);
  }
  let reference = uncertainCommands.get(identity)?.id;
  if (track && !reference) {
    reference = crypto.randomUUID();
    uncertainCommands.set(identity, { id: reference, expires: time + 60 * 60 * 1000 });
  }
  const response = await fetch(url, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      ...(!multipart && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(body !== undefined ? { "X-CSRF-Token": csrf } : {}),
      ...(reference ? { "Idempotency-Key": reference } : {}),
    },
    body: payload,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("The server did not return a confirmation. Check the connection and retry.", response.status);
  }
  if (track && response.status < 500 && uncertainCommands.get(identity)?.id === reference) {
    uncertainCommands.delete(identity);
  }
  if (!response.ok)
    throw new ApiError(result.error || "Request failed. Please try again.", response.status,
      typeof result.field === "string" ? result.field : undefined);
  return result;
}

export const realtimeUrl = import.meta.env.VITE_NEON_REALTIME_URL as string | undefined;

export function getRealtimeClient() {
  if (!realtimeUrl) return null;
  return createRealtimeClient({
    url: realtimeUrl,
    parsers: nodePostgresParsers,
  });
}

export async function getSealedQuery(kind: string = "stones") {
  return request<{ sealed: unknown; url: string; branch: string; kind: string }>(
    "/api/realtime/seal",
    { kind },
    "POST"
  );
}
