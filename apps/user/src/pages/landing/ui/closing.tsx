import type { ReactElement } from "react";

import { ButtonLink, Heading } from "@repo/ui";

function Closing(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center gap-4 px-4 py-16 text-center">
      <Heading as="h2">さっそく始めましょう</Heading>
      <ButtonLink to="/signup" size="large" variant="primary">
        新規登録
      </ButtonLink>
    </section>
  );
}

export { Closing };
