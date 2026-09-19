import { Heading } from "@repo/ui";

import type { ReactElement, ReactNode } from "react";

function OpsPage({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>): ReactElement {
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        {title}
      </Heading>
      {children}
    </main>
  );
}

export { OpsPage };
