import { Heading } from "@repo/ui";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function MessagesBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        メッセージ
      </Heading>
      {children}
    </main>
  );
}

export { MessagesBody };
