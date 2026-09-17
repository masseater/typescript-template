import type { Children } from "./types";
import type { ReactElement } from "react";

function Table({ children }: Children): ReactElement {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className="w-full caption-bottom border-collapse border border-border bg-card text-base"
      >
        {children}
      </table>
    </div>
  );
}

export { Table };
