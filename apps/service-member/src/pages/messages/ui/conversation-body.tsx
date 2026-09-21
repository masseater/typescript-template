import { TextLink } from "@repo/ui";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function ConversationBody({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <TextLink to="/messages" search={{}}>
        メッセージへ戻る
      </TextLink>
      {children}
    </main>
  );
}

export { ConversationBody };
