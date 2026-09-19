import { Closing } from "./closing.tsx";
import { Features } from "./features.tsx";
import { Hero } from "./hero.tsx";

import type { ReactElement } from "react";

function LandingPage(): ReactElement {
  return (
    <main>
      <Hero />
      <Features />
      <Closing />
    </main>
  );
}

export { LandingPage };
