import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Cpu, FileJson2, KeyRound, Moon, Play, ScanText, Settings, Sun, Trash2, Wand2 } from "lucide-react";
import { api } from "./api";
import type { ApiKeyInfo, DocItem, ModelInfo, SchemaInfo } from "./types";
import { Dropzone } from "./components/Dropzone";
import { FileCard } from "./components/FileCard";
import { ResultsPanel } from "./components/ResultsPanel";
import { SettingsModal } from "./components/SettingsModal";

const AUTO = "__auto__";
const CUSTOM = "__custom__";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("idp-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [model, setModel] = useState("");
  const [schemaChoice, setSchemaChoice] = useState(AUTO);
  const [customSchema, setCustomSchema] = useState('{\n  "type": "document",\n  "field": "string"\n}');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const docsRef = useRef(docs);
  docsRef.current = docs;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("idp-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    Promise.all([api.keys(), api.models(), api.schemas()])
      .then(([k, m, s]) => {
        setKeys(k);
        setModels(m);
        setSchemas(s);
        setModel(m[0]?.id ?? "");
        if (!k.find((x) => x.name === "GROQ_API_KEY")?.configured) setShowSettings(true);
      })
      .catch((e) => setBootError(`Backend injoignable : ${(e as Error).message}`));
  }, []);

  // release object urls on unmount
  useEffect(() => () => docsRef.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  const groqReady = keys.find((k) => k.name === "GROQ_API_KEY")?.configured ?? false;

  const schemaText = useMemo(() => {
    if (schemaChoice === AUTO) return null;
    if (schemaChoice === CUSTOM) return customSchema;
    return schemas.find((s) => s.name === schemaChoice)?.content ?? null;
  }, [schemaChoice, customSchema, schemas]);

  const schemaError = useMemo(() => {
    if (schemaChoice !== CUSTOM) return null;
    try {
      JSON.parse(customSchema);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [schemaChoice, customSchema]);

  const addFiles = useCallback((files: File[]) => {
    const items = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setDocs((d) => [...d, ...items]);
    setActiveId((a) => a ?? items[0]?.id);
  }, []);

  const removeDoc = (id: string) => {
    setDocs((d) => {
      const doc = d.find((x) => x.id === id);
      if (doc) URL.revokeObjectURL(doc.url);
      return d.filter((x) => x.id !== id);
    });
    if (activeId === id) setActiveId(undefined);
  };

  const clearAll = () => {
    docs.forEach((d) => URL.revokeObjectURL(d.url));
    setDocs([]);
    setActiveId(undefined);
  };

  const patch = (id: string, p: Partial<DocItem>) => setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const run = async () => {
    const targets = docs.filter((d) => d.status !== "done");
    const queue = targets.length ? targets : docs;
    setRunning(true);
    for (const doc of queue) {
      setActiveId(doc.id);
      patch(doc.id, { status: "processing", error: undefined, result: undefined });
      const start = performance.now();
      try {
        const r = await api.extract(doc.file, model, schemaText);
        patch(doc.id, { status: "done", result: r.data, durationMs: performance.now() - start });
      } catch (e) {
        patch(doc.id, { status: "error", error: (e as Error).message, durationMs: undefined });
      }
    }
    setRunning(false);
  };

  const done = docs.filter((d) => d.status === "done").length;
  const failed = docs.filter((d) => d.status === "error").length;
  const finished = done + failed;
  const pending = docs.length - done;
  const active = docs.find((d) => d.id === activeId);
  const canRun = !running && docs.length > 0 && groqReady && !!model && !schemaError;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <ScanText size={18} />
          </div>
          <div>
            <h1>IDP Studio</h1>
            <span>Intelligent Document Processing</span>
          </div>
        </div>
        <div className="top-actions">
          <button className={`status-chip ${groqReady ? "ok" : "warn"}`} onClick={() => setShowSettings(true)}>
            <span className="dot" />
            {groqReady ? "Groq connecté" : "Clé API manquante"}
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Changer de thème"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Paramètres">
            <Settings size={17} />
          </button>
        </div>
      </header>

      {bootError && (
        <div className="banner">
          <AlertTriangle size={16} /> {bootError}
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <section className="panel">
            <h3>
              <Cpu size={15} /> Modèle
            </h3>
            <div className="model-list">
              {models.map((m) => (
                <label key={m.id} className={`model-card ${model === m.id ? "on" : ""}`}>
                  <input type="radio" name="model" checked={model === m.id} onChange={() => setModel(m.id)} />
                  <span className="mc-icon">{m.kind === "vision" ? <Wand2 size={16} /> : <ScanText size={16} />}</span>
                  <span className="mc-text">
                    <strong>{m.label}</strong>
                    <small>{m.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>
              <FileJson2 size={15} /> Schéma de sortie
            </h3>
            <select value={schemaChoice} onChange={(e) => setSchemaChoice(e.target.value)}>
              <option value={AUTO}>Auto-détection des champs</option>
              {schemas.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name.replace(/_schema\.json$|\.json$/, "").replace(/_/g, " ")}
                </option>
              ))}
              <option value={CUSTOM}>Schéma personnalisé…</option>
            </select>
            {schemaChoice === CUSTOM ? (
              <>
                <textarea
                  className={`schema-edit ${schemaError ? "invalid" : ""}`}
                  value={customSchema}
                  spellCheck={false}
                  onChange={(e) => setCustomSchema(e.target.value)}
                />
                {schemaError && <p className="msg fail small">JSON invalide : {schemaError}</p>}
              </>
            ) : schemaText ? (
              <pre className="schema-preview">{schemaText}</pre>
            ) : (
              <p className="muted small">Le modèle identifie lui-même les champs pertinents du document.</p>
            )}
          </section>

          <div className="run-box">
            {docs.length > 0 && (
              <div className="progress">
                <div className="progress-bar" style={{ width: `${(finished / docs.length) * 100}%` }} />
              </div>
            )}
            <div className="run-stats">
              <span>{docs.length} document(s)</span>
              <span>
                {done} extrait(s){failed ? ` · ${failed} erreur(s)` : ""}
              </span>
            </div>
            <button className="btn btn-primary btn-lg" disabled={!canRun} onClick={run}>
              <Play size={16} />
              {running
                ? "Extraction en cours…"
                : !docs.length
                  ? "Lancer l'extraction"
                  : pending
                    ? `Lancer l'extraction (${pending})`
                    : "Relancer l'extraction"}
            </button>
            {!groqReady && (
              <button className="link-btn" onClick={() => setShowSettings(true)}>
                <KeyRound size={13} /> Configurer la clé API Groq
              </button>
            )}
          </div>
        </aside>

        <main className="main">
          {docs.length === 0 ? (
            <section className="hero">
              <Dropzone onFiles={addFiles} />
              <div className="steps">
                <div>
                  <span>1</span>Déposez vos images (cartes d'identité, factures…)
                </div>
                <div>
                  <span>2</span>Choisissez le modèle et le schéma de sortie
                </div>
                <div>
                  <span>3</span>Récupérez des données structurées en JSON
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="panel files-panel">
                <div className="files-head">
                  <h3>Documents</h3>
                  <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={running}>
                    <Trash2 size={14} /> Tout retirer
                  </button>
                </div>
                <div className="file-grid">
                  {docs.map((d) => (
                    <FileCard
                      key={d.id}
                      doc={d}
                      active={d.id === activeId}
                      disabled={running}
                      onSelect={() => setActiveId(d.id)}
                      onRemove={() => removeDoc(d.id)}
                    />
                  ))}
                  <Dropzone onFiles={addFiles} compact />
                </div>
              </section>
              <ResultsPanel docs={docs} active={active} />
            </>
          )}
        </main>
      </div>

      {showSettings && <SettingsModal keys={keys} onChange={setKeys} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
