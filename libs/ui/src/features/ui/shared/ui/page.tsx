import { Heading } from "./heading";

import type { ReactElement, ReactNode, ReactPortal } from "react";

const layoutClassNames = {
  centered: "mx-auto flex w-full max-w-page flex-col gap-4 p-4",
  full: "flex flex-col gap-4 p-4",
} as const;

const Page = ({
  title,
  children,
  layout = "centered",
}: Readonly<{
  title: string;
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  layout?: keyof typeof layoutClassNames;
}>): ReactElement => {
  return (
    <main data-slot="page" className={layoutClassNames[layout]}>
      <Heading as="h1" size="page">
        {title}
      </Heading>
      {children}
    </main>
  );
};

export { Page };
