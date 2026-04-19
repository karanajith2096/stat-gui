import { useMemo, useState, ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  value?: (row: T) => number | string;
  render?: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
  sortable?: boolean;
  initialSort?: "asc" | "desc";
}

export function SortableTable<T>({
  rows,
  columns,
  defaultSort,
  sort,
  onSortChange,
  getRowKey,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  sort?: { key: string; dir: "asc" | "desc" };
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" }) => void;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  const [internalKey, setInternalKey] = useState<string | undefined>(defaultSort?.key);
  const [internalDir, setInternalDir] = useState<"asc" | "desc">(defaultSort?.dir ?? "desc");

  const sortKey = sort?.key ?? internalKey;
  const sortDir = sort?.dir ?? internalDir;

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.value) return rows;
    const valueOf = col.value;
    return [...rows].sort((a, b) => {
      const va = valueOf(a);
      const vb = valueOf(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [rows, columns, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    const newDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    if (onSortChange) {
      onSortChange({ key, dir: newDir });
    } else {
      setInternalKey(key);
      setInternalDir(newDir);
    }
  };

  return (
    <table className="stat-table">
      <thead>
        <tr>
          {columns.map((c) => {
            const sortable = c.sortable !== false && !!c.value;
            const classes = [c.className ?? ""];
            if (c.align === "left") classes.push("col-team");
            if (sortKey === c.key) classes.push(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
            return (
              <th
                key={c.key}
                className={classes.join(" ").trim()}
                onClick={sortable ? () => toggleSort(c.key) : undefined}
                style={{ cursor: sortable ? "pointer" : "default" }}
              >
                {c.header}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ cursor: onRowClick ? "pointer" : "default" }}
          >
            {columns.map((c) => (
              <td key={c.key} className={c.align === "left" ? "col-team" : c.className ?? ""}>
                {c.render ? c.render(row) : c.value ? c.value(row) : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
