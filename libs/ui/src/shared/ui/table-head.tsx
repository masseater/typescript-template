import type { Children } from "./types";
import type { ReactElement } from "react";

function TableHead({ children }: Children): ReactElement {
  return (
    <th
      data-slot="table-head"
      className="px-2 py-1.5 text-left align-middle text-sm leading-tight font-bold whitespace-nowrap text-foreground"
    >
      {children}
    </th>
  );
}

export { TableHead };
