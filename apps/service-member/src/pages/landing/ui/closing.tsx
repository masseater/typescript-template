import { ButtonLink, Heading } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";

import type { ReactElement } from "react";

function Closing(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center gap-4 px-4 py-16 text-center">
      <Heading as="h2">{m.closing_title()}</Heading>
      <ButtonLink to="/signup" size="large" variant="primary">
        {m.signup_link()}
      </ButtonLink>
    </section>
  );
}

export { Closing };
