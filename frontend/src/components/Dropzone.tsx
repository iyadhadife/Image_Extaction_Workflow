import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export function Dropzone({ onFiles, compact }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => ACCEPT.includes(f.type));
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`dropzone ${over ? "over" : ""} ${compact ? "compact" : ""}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT.join(",")}
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="dz-icon">
        <UploadCloud size={compact ? 20 : 28} />
      </div>
      <div>
        <strong>{compact ? "Ajouter des documents" : "Déposez vos documents ici"}</strong>
        {!compact && <p>ou cliquez pour parcourir — PNG, JPG, WEBP · traitement par lot</p>}
      </div>
    </div>
  );
}
