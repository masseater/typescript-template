import { Heading } from "@repo/ui";

import { FeatureSketch } from "./feature-sketch.tsx";

import type { ReactElement } from "react";
import type { SketchKind } from "./feature-sketch.tsx";

function Feature({
  description,
  reverse,
  sketch,
  title,
}: Readonly<{
  description: string;
  reverse?: boolean;
  sketch: SketchKind;
  title: string;
}>): ReactElement {
  return (
    <li className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10">
      <div className={reverse ? "flex flex-col gap-2 md:order-2" : "flex flex-col gap-2"}>
        <Heading as="h3" size="block">
          {title}
        </Heading>
        <p className="text-base leading-normal text-muted-foreground">{description}</p>
      </div>
      <div className={reverse ? "md:order-1" : undefined}>
        <FeatureSketch kind={sketch} />
      </div>
    </li>
  );
}

export { Feature };
