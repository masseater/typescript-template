import type { Children } from "./types";
import type { ReactElement } from "react";

function TableCell({ children }: Children): ReactElement {
  return (
    <td data-slot="table-cell" className="px-2 py-1.5 align-middle leading-tight">
      {children}
    </td>
  );
}

export { TableCell };
