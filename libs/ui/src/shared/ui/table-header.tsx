import type { ReactElement } from "react";

import type { Children } from "./types";

function TableHeader({ children }: Children): ReactElement {
  return (
    <thead data-slot="table-header" className="bg-head">
      {children}
    </thead>
  );
}

export { TableHeader };
