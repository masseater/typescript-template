import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { ProfileBody } from "./profile-body.tsx";

import type { ReactElement } from "react";

function ProfilePending(): ReactElement {
  return (
    <ProfileBody>
      <div className="flex items-center gap-4">
        <span className="size-20 shrink-0 rounded-full bg-muted" />
        <span className="h-8 w-48 rounded-md bg-muted" />
      </div>
      <StatusMessage variant={STATUS_VARIANT.pending}>
        プロフィールを読み込んでいます。
      </StatusMessage>
    </ProfileBody>
  );
}

export { ProfilePending };
