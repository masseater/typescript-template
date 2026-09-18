import { Heading } from "./heading";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function Page({
  title,
  children,
}: Readonly<{ title: string; children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main data-slot="page" className="mx-auto flex w-full max-w-page flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        {title}
      </Heading>
      {children}
    </main>
  );
}

export { Page };
