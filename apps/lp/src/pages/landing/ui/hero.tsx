import type { ReactNode } from "react";

import { hero } from "#/pages/landing/model/content";

const Hero = (): ReactNode => (
  <section className="flex flex-col items-start gap-6">
    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{hero.title}</h1>
    <p className="text-muted-foreground max-w-2xl text-lg">{hero.lead}</p>
    <a
      className="bg-primary text-primary-foreground rounded-lg px-5 py-3 font-semibold"
      href={hero.href}
    >
      {hero.action}
    </a>
  </section>
);

export { Hero };
