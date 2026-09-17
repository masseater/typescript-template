import { Card, Heading } from "@template/ui";
import type { ReactElement, ReactNode, ReactPortal } from "react";

function CardPage({
  children,
  title,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  title: string;
}>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-column flex-col px-4 py-12">
      <Card>
        <Heading as="h1" size="page">
          {title}
        </Heading>
        {children}
      </Card>
    </main>
  );
}

export { CardPage };
