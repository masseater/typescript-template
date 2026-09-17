import { PageHeading, Stack } from "smarthr-ui";
import type { ReactElement, ReactNode } from "react";

function Page({ title, children }: Readonly<{ title: string; children: ReactNode }>): ReactElement {
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
