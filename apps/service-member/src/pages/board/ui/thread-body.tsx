import { TextLink } from "@repo/ui";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function ThreadBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <TextLink to="/board" search={{}}>
        掲示板へ戻る
      </TextLink>
      {children}
    </main>
  );
}

export { ThreadBody };
