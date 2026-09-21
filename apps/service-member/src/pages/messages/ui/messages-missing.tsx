import { Page, TextLink } from "@repo/ui";

import type { ReactElement } from "react";

function MessagesMissing(): ReactElement {
  return (
    <Page title="会員が見つかりません">
      <p className="text-base leading-normal">
        メッセージを送る相手を表示できません。アドレスが正しいかを確かめてください。
      </p>
      <TextLink to="/messages" search={{}}>
        メッセージへ戻る
      </TextLink>
    </Page>
  );
}

export { MessagesMissing };
