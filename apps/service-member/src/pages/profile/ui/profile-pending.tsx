import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { ProfileBody } from "./profile-body.tsx";

import type { ReactElement } from "react";

function ProfilePending(): ReactElement {
  return (
    <ProfileBody>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="h-24 bg-muted" />
        <div className="px-5 pb-5">
          <div className="-mt-10 size-20 rounded-full bg-muted" />
        </div>
      </div>
      <StatusMessage variant={STATUS_VARIANT.pending}>
        プロフィールを読み込んでいます。
      </StatusMessage>
    </ProfileBody>
  );
}

export { ProfilePending };
