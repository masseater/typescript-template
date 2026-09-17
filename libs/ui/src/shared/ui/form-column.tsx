import type { Children } from "./types";
import type { ReactElement } from "react";

function FormColumn({ children }: Children): ReactElement {
  return (
    <div data-slot="form-column" className="flex w-full max-w-md flex-col gap-4">
      {children}
    </div>
  );
}

export { FormColumn };
