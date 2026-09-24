import { STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { type ReactElement } from "react";

const InvitePending = (): ReactElement => (
  <StatusMessage variant={STATUS_VARIANT.pending}>{"招待を確認しています。"}</StatusMessage>
);

export { InvitePending };
