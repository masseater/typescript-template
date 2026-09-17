import type { Children } from "./types";
import type { ReactElement } from "react";

function TableRow({ children }: Children): ReactElement {
  return (
    <tr data-slot="table-row" className="border-b border-border last:border-b-0">
      {children}
    </tr>
  );
}

export { TableRow };
