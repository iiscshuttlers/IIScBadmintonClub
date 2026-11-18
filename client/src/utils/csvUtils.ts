/**
 * CSV Utilities for exporting and parsing CSV files.
 */

export function downloadCSV(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export function readCSVFile(file: File): Promise<string[][]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const rows = text.split(/\r?\n/).map((line) => {
        // Simple RFC 4180 CSV parse
        const fields: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQ && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQ = !inQ;
            }
          } else if (ch === "," && !inQ) {
            fields.push(cur);
            cur = "";
          } else {
            cur += ch;
          }
        }
        fields.push(cur);
        return fields.map((f) => f.trim());
      }).filter((r) => r.some((c) => c));
      resolve(rows);
    };
    reader.readAsText(file);
  });
}
