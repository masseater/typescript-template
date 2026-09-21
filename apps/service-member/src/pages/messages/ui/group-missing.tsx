import { Page, TextLink } from "@repo/ui";

import type { ReactElement } from "react";

function GroupMissing(): ReactElement {
  return (
    <Page title="グループが見つかりません">
      <p className="text-base leading-normal">
        このグループは表示できません。招待リンクが正しいかを確かめてください。
      </p>
      <TextLink to="/messages" search={{}}>
        メッセージへ戻る
      </TextLink>
    </Page>
  );
}

export { GroupMissing };
