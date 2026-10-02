export type ApiKeyInfo = {
  name: string;
  description: string;
  configured: boolean;
  source: "ui" | "env" | null;
  masked: string | null;
};

export type ModelInfo = {
  id: string;
  label: string;
  kind: "vision" | "ocr";
  description: string;
};

export type SchemaInfo = { name: string; content: string };

export type FileStatus = "pending" | "processing" | "done" | "error";

export type DocItem = {
  id: string;
  file: File;
  url: string;
  status: FileStatus;
  result?: unknown;
  error?: string;
  durationMs?: number;
};
