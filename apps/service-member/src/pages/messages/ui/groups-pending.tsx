import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { GroupsBody } from "./open-groups-page.tsx";

import type { ReactElement } from "react";

function GroupsPending(): ReactElement {
  return (
    <GroupsBody>
      <StatusMessage variant={STATUS_VARIANT.pending}>グループを読み込んでいます。</StatusMessage>
    </GroupsBody>
  );
}

export { GroupsPending };
