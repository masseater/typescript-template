import { Heading } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";
import { Feature } from "./feature.tsx";

import type { ReactElement } from "react";
import type { SketchKind } from "./feature-sketch.tsx";

const features: ReadonlyArray<{
  description: () => string;
  reverse: boolean;
  sketch: SketchKind;
  title: () => string;
}> = [
  {
    description: m.feature_profile_body,
    reverse: false,
    sketch: "profile",
    title: m.feature_profile_title,
  },
  {
    description: m.feature_search_body,
    reverse: true,
    sketch: "search",
    title: m.feature_search_title,
  },
  {
    description: m.feature_security_body,
    reverse: false,
    sketch: "security",
    title: m.feature_security_title,
  },
];

function Features(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-wide flex-col gap-10 px-4 py-16">
      <Heading as="h2">{m.features_title()}</Heading>
      <ul className="flex flex-col gap-12">
        {features.map((feature) => (
          <Feature
            key={feature.sketch}
            title={feature.title()}
            description={feature.description()}
            sketch={feature.sketch}
            reverse={feature.reverse}
          />
        ))}
      </ul>
    </section>
  );
}

export { Features };
