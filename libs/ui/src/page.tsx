import { PageHeading, Stack } from "smarthr-ui";
import type { ReactElement, ReactNode, ReactPortal } from "react";

function Page({
  title,
  children,
}: Readonly<{ title: string; children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main>
      <Stack>
        <PageHeading>{title}</PageHeading>
        {children}
      </Stack>
    </main>
  );
}

export { Page };
