import { Array as Arr, pipe } from "effect";
import type { ReactNode } from "react";

import { steps } from "#/pages/landing/model/content";

const StepList = (): ReactNode => (
  <section aria-labelledby="steps" className="flex flex-col gap-6">
    <h2 className="text-2xl font-bold" id="steps">
      {steps.title}
    </h2>
    <ol className="flex list-inside list-decimal flex-col gap-2">
      {pipe(
        steps.items,
        Arr.map((step) => <li key={step}>{step}</li>),
      )}
    </ol>
  </section>
);

export { StepList };
