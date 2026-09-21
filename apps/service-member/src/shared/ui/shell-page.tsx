import { Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function ShellPage({
  detail,
  title,
}: Readonly<{
  detail: string;
  title: string;
}>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        {title}
      </Heading>
      <StatusMessage variant={STATUS_VARIANT.empty}>{detail}</StatusMessage>
    </main>
  );
}

export { ShellPage };
