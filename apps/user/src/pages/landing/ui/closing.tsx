import { ButtonLink, Heading } from "@template/ui";
import type { ReactElement } from "react";

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
