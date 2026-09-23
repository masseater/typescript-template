import { Consequences } from "./consequences.tsx";
import { Hero } from "./hero.tsx";

import type { ReactElement } from "react";

function LandingPage(): ReactElement {
  return (
    <main>
      <Hero />
      <Consequences />
    </main>
  );
}

export { LandingPage };
