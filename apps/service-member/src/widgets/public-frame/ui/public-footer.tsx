import { TextLink } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

function PublicFooter(): ReactElement {
  return (
    <footer className="border-t border-border px-4 py-6 text-center text-sm leading-normal text-muted-foreground">
      <p>{serviceName}</p>
      <p className="mt-2">
        <TextLink to="/contact">お問い合わせ</TextLink>
      </p>
    </footer>
  );
}

export { PublicFooter };
