import { Fragment } from "react";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

// light syntax highlighting of a pretty-printed JSON string
export function JsonView({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2) ?? "";
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    if (m[1]) {
      parts.push(
        <span key={i} className={m[2] ? "j-key" : "j-str"}>
          {m[1]}
        </span>,
      );
      if (m[2]) parts.push(m[2]);
    } else if (m[3]) {
      parts.push(<span key={i} className="j-lit">{m[3]}</span>);
    } else {
      parts.push(<span key={i} className="j-num">{m[4]}</span>);
    }
    last = i + m[0].length;
  }
  parts.push(text.slice(last));
  return (
    <pre className="json-view">
      <code>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</code>
    </pre>
  );
}
