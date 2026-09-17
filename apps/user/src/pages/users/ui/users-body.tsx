import type { ReactElement, ReactNode, ReactPortal } from "react";
import { Heading } from "@template/ui/ui";

function UsersBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        ユーザーを探す
      </Heading>
      {children}
    </main>
  );
}

export { UsersBody };
