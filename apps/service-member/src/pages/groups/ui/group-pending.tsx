import { GroupBody } from "./group-body.tsx";

import type { ReactElement } from "react";

function GroupPending(): ReactElement {
  return <GroupBody>読み込み中…</GroupBody>;
}

export { GroupPending };
