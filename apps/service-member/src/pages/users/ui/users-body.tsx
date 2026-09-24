import { Heading } from "@repo/ui";

import { SearchForm } from "./search-form.tsx";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function UsersBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-wide flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        探す
      </Heading>
      <SearchForm />
      {children}
    </main>
  );
}

export { UsersBody };
