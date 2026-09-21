import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

const ForbiddenNotice = (): ReactElement => (
  <StatusMessage variant={STATUS_VARIANT.failure}>権限がありません。</StatusMessage>
);

export { ForbiddenNotice };
