import { TextLink } from "@repo/ui";

import { GroupBody } from "./group-body.tsx";

import type { ReactElement } from "react";

function GroupMissing(): ReactElement {
  return (
    <GroupBody>
      <p className="text-base leading-normal">グループが見つかりません。</p>
      <TextLink to="/home">ホームへ</TextLink>
    </GroupBody>
  );
}

export { GroupMissing };
