import type { ReactElement } from "react";
import type { Children } from "./types";

const TableBody = ({ children }: Children): ReactElement => (
  <tbody data-slot="table-body">{children}</tbody>
);

export { TableBody };
