import { Page, TextLink } from "@repo/ui";

import type { ReactElement } from "react";

function ConversationMissing(): ReactElement {
  return (
    <Page title="会話が見つかりません">
      <p className="text-base leading-normal">
        この会話は表示できません。アドレスが正しいかを確かめてください。
      </p>
      <TextLink to="/messages" search={{}}>
        メッセージへ戻る
      </TextLink>
    </Page>
  );
}

export { ConversationMissing };
