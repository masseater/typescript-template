import { Heading } from "@repo/ui";

import { ChatForm } from "./chat-form.tsx";
import { ChatLog } from "./chat-log.tsx";

import type { ChatState } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

function ChatPane({ chat }: Readonly<{ chat: ChatState }>): ReactElement {
  return (
    <section aria-label="司令塔との会話" className="flex min-h-0 flex-col gap-3 p-4">
      <Heading as="h1" size="page">
        司令塔
      </Heading>
      <ChatLog chat={chat} />
      <ChatForm busy={chat.busy} />
    </section>
  );
}

export { ChatPane };
