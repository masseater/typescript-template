import type { ReactNode } from "react";

import { FeatureList } from "./feature-list.tsx";
import { Hero } from "./hero.tsx";
import { StepList } from "./step-list.tsx";

export const LandingPage = (): ReactNode => (
  <main className="mx-auto flex max-w-4xl flex-col gap-20 px-6 py-20">
    <Hero />
    <FeatureList />
    <StepList />
  </main>
);
