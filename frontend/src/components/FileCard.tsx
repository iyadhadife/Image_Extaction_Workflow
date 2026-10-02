import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { DocItem } from "../types";

const LABEL = { pending: "En attente", processing: "Analyse…", done: "Extrait", error: "Erreur" };

export function FileCard({
  doc,
  active,
  onSelect,
  onRemove,
  disabled,
}: {
  doc: DocItem;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className={`file-card ${active ? "active" : ""} s-${doc.status}`} onClick={onSelect} title={doc.error}>
      <div className="thumb">
        <img src={doc.url} alt="" />
        {doc.status === "processing" && <div className="scan" />}
      </div>
      <div className="file-meta">
        <span className="file-name">{doc.file.name}</span>
        <span className="file-sub">
          <span className={`badge b-${doc.status}`}>
            {doc.status === "processing" && <Loader2 size={12} className="spin" />}
            {doc.status === "done" && <CheckCircle2 size={12} />}
            {doc.status === "error" && <AlertTriangle size={12} />}
            {LABEL[doc.status]}
          </span>
          {(doc.file.size / 1024).toFixed(0)} Ko
        </span>
      </div>
      <button
        className="icon-btn ghost remove"
        aria-label="Retirer"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
