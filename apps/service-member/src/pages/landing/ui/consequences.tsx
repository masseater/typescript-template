import { Heading } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";
import { MemberSearchStill } from "#widgets/member-search/index.ts";
import { SecurityStill } from "./security-still.tsx";

import type { ReactElement } from "react";

function Consequences(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-page flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-2">
        <Heading as="h2">{m.consequences_title()}</Heading>
        <p className="text-base leading-normal text-muted-foreground">{m.consequences_body()}</p>
      </div>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <Heading as="h3" size="block">
            {m.feature_search_title()}
          </Heading>
          <p className="text-base leading-normal text-muted-foreground">{m.feature_search_body()}</p>
          <MemberSearchStill />
        </section>
        <section className="flex flex-col gap-3">
          <Heading as="h3" size="block">
            {m.feature_security_title()}
          </Heading>
          <p className="text-base leading-normal text-muted-foreground">
            {m.feature_security_body()}
          </p>
          <SecurityStill />
        </section>
      </div>
    </section>
  );
}

export { Consequences };
