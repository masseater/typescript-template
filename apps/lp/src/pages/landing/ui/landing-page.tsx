import type { ReactNode } from "react";

import { FeatureList } from "./feature-list";
import { Hero } from "./hero";
import { StepList } from "./step-list";

const LandingPage = (): ReactNode => (
  <main className="mx-auto flex max-w-4xl flex-col gap-20 px-6 py-20">
    <Hero />
    <FeatureList />
    <StepList />
  </main>
);

export { LandingPage };
