import type { ReactElement } from "react";
import type { Children } from "./types";

function Card({ children }: Children): ReactElement {
  return (
    <div
      data-slot="card"
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      {children}
    </div>
  );
}

export { Card };
