import { Page, TextLink } from "@repo/ui";

import type { ReactElement } from "react";

function ThreadMissing(): ReactElement {
  return (
    <Page title="スレッドが見つかりません">
      <p className="text-base leading-normal">
        このスレッドは表示できません。アドレスが正しいかを確かめてください。
      </p>
      <TextLink to="/board" search={{}}>
        掲示板へ戻る
      </TextLink>
    </Page>
  );
}

export { ThreadMissing };
