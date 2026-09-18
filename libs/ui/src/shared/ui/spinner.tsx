import { Loader2Icon } from "lucide-react";

import type { ReactElement } from "react";

function Spinner(): ReactElement {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
    />
  );
}

export { Spinner };
