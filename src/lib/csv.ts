export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let s = value == null ? "" : String(value);
    // Neutralize spreadsheet formula injection: a leading =, +, -, or @
    // (possibly behind whitespace/control chars) executes when the export is
    // opened in Excel/Sheets. Quoting alone does not prevent evaluation.
    if (/^[\s\p{Cc}]*[=+\-@]/u.test(s)) s = `'${s}`;
    return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}
