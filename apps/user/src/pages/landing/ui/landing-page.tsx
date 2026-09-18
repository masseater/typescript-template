import { serviceName } from "#shared/config/index.ts";
import { Closing } from "./closing.tsx";
import { Features } from "./features.tsx";
import { Hero } from "./hero.tsx";

import type { ReactElement } from "react";

const LandingPage = (): ReactElement => {
  return (
    <>
      <main>
        <Hero />
        <Features />
        <Closing />
      </main>
      <footer className="border-t border-border px-4 py-6 text-center text-sm leading-normal text-muted-foreground">
        {serviceName}
      </footer>
    </>
  );
};

export { LandingPage };
