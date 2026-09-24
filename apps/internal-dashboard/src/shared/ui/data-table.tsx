import type { ReactElement, ReactNode } from "react";

function DataTable({
  columns,
  label,
  rows,
}: Readonly<{
  columns: readonly string[];
  label: string;
  rows: ReactNode;
}>): ReactElement {
  return (
    <table aria-label={label} className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-border">
          {columns.map((column) => (
            <th key={column} className="p-2">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

export { DataTable };
