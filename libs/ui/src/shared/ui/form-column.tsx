import type { ReactElement } from "react";
import type { Children } from "./types";

const FormColumn = ({ children }: Children): ReactElement => {
  return (
    <div data-slot="form-column" className="flex w-full max-w-column flex-col gap-4">
      {children}
    </div>
  );
};

export { FormColumn };
