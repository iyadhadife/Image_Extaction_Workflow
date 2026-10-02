import { useState } from "react";
import { Braces, Check, Copy, Download, FileSearch, Rows3, ZoomIn, ZoomOut } from "lucide-react";
import type { DocItem } from "../types";
import { JsonView } from "./JsonView";
import { FieldsTable } from "./FieldsTable";

function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
  };
}

export function consolidated(docs: DocItem[]) {
  const out: unknown[] = [];
  for (const d of docs) {
    if (d.status !== "done") continue;
    const items = Array.isArray(d.result) ? d.result : [d.result];
    for (const item of items) {
      out.push(item && typeof item === "object" ? { ...(item as object), _Source_File: d.file.name } : item);
    }
  }
  return out;
}

export function ResultsPanel({ docs, active }: { docs: DocItem[]; active: DocItem | undefined }) {
  const [tab, setTab] = useState<"doc" | "all">("doc");
  const [view, setView] = useState<"fields" | "json">("fields");
  const [zoom, setZoom] = useState(1);
  const { copied, copy } = useCopy();
  const all = consolidated(docs);
  const allText = JSON.stringify(all, null, 2);

  const download = () => {
    const blob = new Blob([allText], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "batch_extraction_results.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="panel results">
      <div className="results-head">
        <div className="tabs">
          <button className={tab === "doc" ? "on" : ""} onClick={() => setTab("doc")}>
            <FileSearch size={15} /> Explorateur
          </button>
          <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
            <Braces size={15} /> JSON consolidé <span className="count">{all.length}</span>
          </button>
        </div>
        {tab === "all" && (
          <div className="actions">
            <button className="btn btn-secondary btn-sm" onClick={() => copy(allText)} disabled={!all.length}>
              {copied ? <Check size={14} /> : <Copy size={14} />} Copier
            </button>
            <button className="btn btn-primary btn-sm" onClick={download} disabled={!all.length}>
              <Download size={14} /> Télécharger
            </button>
          </div>
        )}
      </div>

      {tab === "all" ? (
        all.length ? (
          <JsonView value={all} />
        ) : (
          <div className="empty">Aucun résultat pour le moment. Lancez une extraction.</div>
        )
      ) : !active ? (
        <div className="empty">Sélectionnez un document pour l'inspecter.</div>
      ) : (
        <div className="split">
          <div className="viewer">
            <div className="viewer-bar">
              <span className="file-name">{active.file.name}</span>
              <div className="zoom">
                <button className="icon-btn ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Dézoomer">
                  <ZoomOut size={15} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button className="icon-btn ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoomer">
                  <ZoomIn size={15} />
                </button>
              </div>
            </div>
            <div className="viewer-canvas">
              <img src={active.url} alt={active.file.name} style={{ width: `${zoom * 100}%` }} />
            </div>
          </div>
          <div className="data">
            <div className="viewer-bar">
              <div className="seg">
                <button className={view === "fields" ? "on" : ""} onClick={() => setView("fields")}>
                  <Rows3 size={14} /> Champs
                </button>
                <button className={view === "json" ? "on" : ""} onClick={() => setView("json")}>
                  <Braces size={14} /> JSON
                </button>
              </div>
              {active.status === "done" && (
                <button className="btn btn-ghost btn-sm" onClick={() => copy(JSON.stringify(active.result, null, 2))}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} Copier
                </button>
              )}
            </div>
            <div className="data-body">
              {active.status === "done" ? (
                view === "fields" ? <FieldsTable value={active.result} /> : <JsonView value={active.result} />
              ) : active.status === "error" ? (
                <div className="empty error">{active.error}</div>
              ) : active.status === "processing" ? (
                <div className="skeleton">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="sk-row" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : (
                <div className="empty">Ce document n'a pas encore été analysé.</div>
              )}
            </div>
            {active.durationMs !== undefined && <div className="data-foot">Analysé en {(active.durationMs / 1000).toFixed(1)} s</div>}
          </div>
        </div>
      )}
    </section>
  );
}
