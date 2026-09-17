import type { ReactNode } from "react";
import { Heading } from "./heading";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main data-slot="page" className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <Heading as="h1" size="screen">
        {title}
      </Heading>
      {children}
    </main>
  );
}

export { Page };
