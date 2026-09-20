import { Heading } from "@repo/ui";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function BoardBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        掲示板
      </Heading>
      {children}
    </main>
  );
}

export { BoardBody };
