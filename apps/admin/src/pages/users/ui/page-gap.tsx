import type { ReactElement } from "react";

function PageGap(): ReactElement {
  return (
    <li aria-hidden="true" className="px-1 text-muted-foreground">
      …
    </li>
  );
}

export { PageGap };
