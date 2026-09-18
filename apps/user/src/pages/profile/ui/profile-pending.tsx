import type { ReactElement } from "react";

import { Status } from "@template/ui";

import { ProfileBody } from "./profile-body.tsx";

function ProfilePending(): ReactElement {
  return (
    <ProfileBody>
      <div className="flex items-center gap-4">
        <span className="size-20 shrink-0 rounded-full bg-muted" />
        <span className="h-8 w-48 rounded-md bg-muted" />
      </div>
      <Status variant="pending">プロフィールを読み込んでいます。</Status>
    </ProfileBody>
  );
}

export { ProfilePending };
