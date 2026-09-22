import { Page, TextLink } from "@repo/ui";

import type { ReactElement } from "react";

function ProfileMissing(): ReactElement {
  return (
    <Page title="利用者が見つかりません">
      <p className="text-base leading-normal">
        この利用者のプロフィールは表示できません。アドレスが正しいかを確かめてください。
      </p>
      <TextLink to="/search">探す</TextLink>
    </Page>
  );
}

export { ProfileMissing };
