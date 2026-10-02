type Row = { path: string; value: string; kind: string };

function flatten(value: unknown, prefix = "", rows: Row[] = []): Row[] {
  if (Array.isArray(value)) {
    if (value.length === 0) rows.push({ path: prefix || "(racine)", value: "[]", kind: "empty" });
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, rows));
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) rows.push({ path: prefix || "(racine)", value: "{}", kind: "empty" });
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, rows);
  } else {
    rows.push({
      path: prefix || "(valeur)",
      value: value === null || value === undefined ? "—" : String(value),
      kind: value === null || value === undefined || value === "" ? "empty" : typeof value,
    });
  }
  return rows;
}

// readable key/value view of a (possibly nested) extraction result
export function FieldsTable({ value }: { value: unknown }) {
  const rows = flatten(value).filter((r) => r.path !== "_Source_File");
  return (
    <table className="fields">
      <tbody>
        {rows.map((r) => (
          <tr key={r.path}>
            <th>{r.path.replace(/_/g, " ")}</th>
            <td className={`v-${r.kind}`}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
