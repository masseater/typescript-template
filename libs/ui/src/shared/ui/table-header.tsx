import type { Children } from "./types";
import type { ReactElement } from "react";

function TableHeader({ children }: Children): ReactElement {
  return (
    <thead data-slot="table-header" className="bg-head">
      {children}
    </thead>
  );
}

export { TableHeader };
