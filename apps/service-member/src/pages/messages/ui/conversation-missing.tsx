import { TextLink } from "@repo/ui";

import { ConversationBody } from "./conversation-body.tsx";

import type { ReactElement } from "react";

function ConversationMissing(): ReactElement {
  return (
    <ConversationBody>
      <p className="text-base leading-normal">会話が見つかりません。</p>
      <TextLink to="/messages" search={{}}>
        一覧へ
      </TextLink>
    </ConversationBody>
  );
}

export { ConversationMissing };
