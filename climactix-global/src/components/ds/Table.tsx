"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Download,
  FileDown,
  Pin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Input from "./Input";
import Button from "./Button";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  width?: number;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  pageSize?: number;
  searchable?: boolean;
  exportFilename?: string;
  onRowClick?: (row: T) => void;
}

type SortDir = "asc" | "desc" | null;

export default function Table<T>({
  columns,
  data,
  getRowId,
  pageSize = 8,
  searchable = true,
  exportFilename = "climactix-export",
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(columns[0]?.key ?? null);
  const [page, setPage] = useState(0);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const dragState = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => String(col.accessor(row) ?? "").toLowerCase().includes(q))
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const getVal = col.sortValue ?? ((row: T) => String(col.accessor(row) ?? ""));
    return [...filtered].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((prevDir) => (prevDir === "asc" ? "desc" : prevDir === "desc" ? null : "asc"));
      return key;
    });
    setPage(0);
  }, []);

  const startResize = useCallback(
    (key: string, e: React.MouseEvent) => {
      dragState.current = { key, startX: e.clientX, startWidth: widths[key] ?? 160 };
      const onMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const delta = ev.clientX - dragState.current.startX;
        setWidths((prev) => ({
          ...prev,
          [dragState.current!.key]: Math.max(80, dragState.current!.startWidth + delta),
        }));
      };
      const onUp = () => {
        dragState.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [widths]
  );

  const exportCsv = useCallback(() => {
    const header = columns.map((c) => c.header).join(",");
    const rows = sorted.map((row) =>
      columns.map((c) => `"${String(c.accessor(row) ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, columns, exportFilename]);

  const exportPdf = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    (doc as unknown as { autoTable: (opts: object) => void }).autoTable({
      head: [columns.map((c) => c.header)],
      body: sorted.map((row) => columns.map((c) => String(c.accessor(row) ?? ""))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 61, 145] },
    });
    doc.save(`${exportFilename}.pdf`);
  }, [sorted, columns, exportFilename]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        {searchable ? (
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search table…"
            leftIcon={<Search size={14} />}
            className="max-w-xs"
            aria-label="Search table"
          />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download size={14} /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={exportPdf}>
            <FileDown size={14} /> PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-ds-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 bg-ds-surface">
              {columns.map((col) => {
                const pinned = pinnedKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: widths[col.key] ?? col.width }}
                    className={cn(
                      "relative select-none border-b border-ds-border px-3 py-2.5 font-ds-body text-[12px] font-medium uppercase tracking-wide text-ds-text2",
                      col.align === "right" ? "text-right" : "text-left",
                      pinned && "sticky left-0 z-20 bg-ds-surface"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-ds-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent rounded"
                      >
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ChevronUp size={12} />
                          ) : sortDir === "desc" ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronsUpDown size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="opacity-30" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPinnedKey(pinned ? null : col.key)}
                        aria-label={pinned ? `Unpin ${col.header}` : `Pin ${col.header}`}
                        className={cn("ml-auto", pinned ? "text-ds-accent" : "text-ds-border hover:text-ds-muted")}
                      >
                        <Pin size={11} />
                      </button>
                    </div>
                    <div
                      onMouseDown={(e) => startResize(col.key, e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-ds-accent/40"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-ds-border last:border-0 transition-colors duration-150",
                  onRowClick && "cursor-pointer hover:bg-ds-surface"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ width: widths[col.key] ?? col.width }}
                    className={cn(
                      "px-3 py-2.5 font-ds-body text-[14px] text-ds-text",
                      col.align === "right" ? "text-right" : "text-left",
                      pinnedKey === col.key && "sticky left-0 bg-white"
                    )}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center font-ds-body text-[13px] text-ds-muted">
                  No matching rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between font-ds-body text-[12px] text-ds-muted">
        <span>
          Showing {pageRows.length === 0 ? 0 : page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of{" "}
          {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="rounded-md p-1.5 hover:bg-ds-surface disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-1">
            {page + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
            className="rounded-md p-1.5 hover:bg-ds-surface disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
