export function exportCsv<T extends object>(filename: string, rows: T[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]) as (keyof T)[];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "")}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPng(filename: string, element: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, { backgroundColor: "#FFFFFF", scale: 2 });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  a.click();
}
