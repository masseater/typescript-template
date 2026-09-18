import type { ReactElement } from "react";

import type { Children } from "./types";

function TableCell({ children, colSpan }: Children & Readonly<{ colSpan?: number }>): ReactElement {
  return (
    <td
      data-slot="table-cell"
      colSpan={colSpan}
      className="px-2 py-1.5 align-middle leading-tight whitespace-nowrap"
    >
      {children}
    </td>
  );
}

export { TableCell };
