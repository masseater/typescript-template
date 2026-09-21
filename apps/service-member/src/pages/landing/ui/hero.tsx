import { Heading } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";
import { m } from "#shared/i18n/index.ts";
import { ProfilePreview } from "./profile-preview.tsx";

import type { ReactElement } from "react";

function Hero(): ReactElement {
  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-16">
        <p className="text-sm leading-tight font-bold text-foreground">{serviceName}</p>
        <h1 className="text-2xl leading-tight font-bold text-foreground">{m.hero_title()}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">{m.hero_body()}</p>
        <div className="flex flex-col gap-2">
          <Heading as="h2" size="block">
            {m.feature_profile_title()}
          </Heading>
          <p className="text-base leading-normal text-muted-foreground">{m.feature_profile_body()}</p>
        </div>
        <ProfilePreview />
      </div>
    </section>
  );
}

export { Hero };
