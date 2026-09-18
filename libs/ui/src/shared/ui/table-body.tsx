import type { ReactElement } from "react";
import type { Children } from "./types";

function TableBody({ children }: Children): ReactElement {
  return <tbody data-slot="table-body">{children}</tbody>;
}

export { TableBody };
