import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Trash2, X, XCircle } from "lucide-react";
import { api } from "../api";
import type { ApiKeyInfo } from "../types";

type TestState = { status: "idle" | "testing" | "ok" | "fail"; message?: string };

function KeyRow({ info, onChange }: { info: ApiKeyInfo; onChange: (keys: ApiKeyInfo[]) => void }) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doTest = () =>
    run(async () => {
      setTest({ status: "testing" });
      const r = await api.testKey(info.name, value);
      setTest(r.valid ? { status: "ok", message: "Clé valide" } : { status: "fail", message: r.error ?? "Clé refusée" });
    }).catch(() => setTest({ status: "idle" }));

  return (
    <div className="key-row">
      <div className="key-head">
        <div className="key-icon">
          <KeyRound size={18} />
        </div>
        <div className="key-title">
          <code>{info.name}</code>
          <span>{info.description}</span>
        </div>
        <span className={`pill ${info.configured ? "pill-ok" : "pill-warn"}`}>
          {info.configured ? (info.source === "env" ? "Fichier .env" : "Interface") : "Non configurée"}
        </span>
      </div>

      {info.configured && (
        <div className="key-current">
          <span>Clé actuelle</span>
          <code>{info.masked}</code>
          {info.source === "ui" && (
            <button
              className="btn btn-ghost btn-sm danger"
              disabled={busy}
              onClick={() => run(async () => onChange(await api.deleteKey(info.name)))}
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
        </div>
      )}

      <form
        className="key-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          run(async () => {
            onChange(await api.saveKey(info.name, value.trim()));
            setValue("");
            setTest({ status: "idle" });
          });
        }}
      >
        <div className="input-wrap">
          <input
            type={visible ? "text" : "password"}
            placeholder={info.configured ? "Remplacer par une nouvelle clé…" : "gsk_…"}
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setValue(e.target.value);
              setTest({ status: "idle" });
            }}
          />
          <button type="button" className="icon-btn ghost" onClick={() => setVisible((v) => !v)} aria-label="Afficher">
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy || (!value && !info.configured)} onClick={doTest}>
          {test.status === "testing" ? <Loader2 size={14} className="spin" /> : null} Tester
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
          Enregistrer
        </button>
      </form>

      {test.status === "ok" && (
        <p className="msg ok">
          <CheckCircle2 size={14} /> {test.message}
        </p>
      )}
      {test.status === "fail" && (
        <p className="msg fail">
          <XCircle size={14} /> {test.message}
        </p>
      )}
      {error && (
        <p className="msg fail">
          <XCircle size={14} /> {error}
        </p>
      )}
    </div>
  );
}

export function SettingsModal({
  keys,
  onClose,
  onChange,
}: {
  keys: ApiKeyInfo[];
  onClose: () => void;
  onChange: (keys: ApiKeyInfo[]) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>Paramètres</h2>
            <p>Clés API utilisées par le backend. Elles sont stockées côté serveur et ne sont jamais réaffichées en clair.</p>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          {keys.map((k) => (
            <KeyRow key={k.name} info={k} onChange={onChange} />
          ))}
          <p className="hint">
            Pas encore de clé ? Créez-en une gratuitement sur{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              console.groq.com/keys
            </a>
            . Une clé saisie ici est prioritaire sur celle du fichier <code>.env</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
