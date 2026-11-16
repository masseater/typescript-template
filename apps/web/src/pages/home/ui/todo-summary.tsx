import type { ReactNode } from "react";

export const TodoSummary = ({
  open,
  done,
}: Readonly<{ open: number; done: number }>): ReactNode => (
  <p className="text-muted-foreground text-sm">{`${open} open / ${done} done`}</p>
);
