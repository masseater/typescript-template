import type { Children } from "./types";
import type { ReactElement } from "react";

function TableCell({ children, colSpan }: Children & Readonly<{ colSpan?: number }>): ReactElement {
  return (
    <td data-slot="table-cell" colSpan={colSpan} className="px-2 py-1.5 align-middle leading-tight">
      {children}
    </td>
  );
}

export { TableCell };
