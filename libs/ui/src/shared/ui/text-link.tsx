import { createLink } from "@tanstack/react-router";

import type { ComponentProps, ReactElement } from "react";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function TextAnchor({ children, ...anchor }: Readonly<ComponentProps<"a">>): ReactElement {
  return (
    <a
      // oxlint-disable-next-line react/jsx-props-no-spreading
      {...anchor}
      data-slot="text-link"
      className="rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
    >
      {children}
    </a>
  );
}

const TextLink = createLink(TextAnchor);

export { TextLink };
