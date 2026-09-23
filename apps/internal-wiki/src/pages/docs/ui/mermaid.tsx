import { SvgDiagram } from "./svg-diagram.tsx";

import type { ReactElement } from "react";

function Mermaid({
  aspect,
  svg,
}: Readonly<{ aspect: string; chart: string; svg: string }>): ReactElement {
  return (
    <figure className="bg-fd-background not-prose my-6">
      <SvgDiagram aspect={aspect} svg={svg} />
    </figure>
  );
}

export { Mermaid };
