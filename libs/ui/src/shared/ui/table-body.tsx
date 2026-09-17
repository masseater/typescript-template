import type { Children } from "./types";
import type { ReactElement } from "react";

function TableBody({ children }: Children): ReactElement {
  return <tbody data-slot="table-body">{children}</tbody>;
}

export { TableBody };
