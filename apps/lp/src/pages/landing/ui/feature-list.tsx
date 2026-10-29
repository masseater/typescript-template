import { Array as Arr, pipe } from "effect";
import type { ReactNode } from "react";

import { features } from "#/pages/landing/model/content";

import { FeatureCard } from "./feature-card";

const FeatureList = (): ReactNode => (
  <section aria-labelledby="features" className="flex flex-col gap-6">
    <h2 className="text-2xl font-bold" id="features">
      {features.title}
    </h2>
    <ul className="grid gap-4 sm:grid-cols-3">
      {pipe(
        features.items,
        Arr.map(({ title, body }) => <FeatureCard body={body} key={title} title={title} />),
      )}
    </ul>
  </section>
);

export { FeatureList };
