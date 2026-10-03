import type { ApiKeyInfo, ModelInfo, SchemaInfo } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* not json */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  models: () => request<ModelInfo[]>("/api/models"),
  schemas: () => request<SchemaInfo[]>("/api/schemas"),
  keys: () => request<ApiKeyInfo[]>("/api/settings/keys"),
  saveKey: (name: string, value: string) => request<ApiKeyInfo[]>(`/api/settings/keys/${name}`, json("PUT", { value })),
  deleteKey: (name: string) => request<ApiKeyInfo[]>(`/api/settings/keys/${name}`, json("DELETE")),
  testKey: (name: string, value?: string) =>
    request<{ valid: boolean; error: string | null }>(`/api/settings/keys/${name}/test`, json("POST", { value: value || null })),
  extract: (file: File, model: string, schema: string | null) => {
    const form = new FormData();
    form.append("file", file);
    form.append("model", model);
    if (schema) form.append("schema_json", schema);
    return request<{ file: string; model: string; data: unknown }>("/api/extract", { method: "POST", body: form });
  },
};
