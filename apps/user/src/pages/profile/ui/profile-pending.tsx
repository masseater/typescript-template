import type { ReactElement } from "react";
import { Status } from "@template/ui/ui";

function ProfilePending(): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-4">
        <span className="size-20 shrink-0 rounded-full bg-muted" />
        <span className="h-8 w-48 rounded-md bg-muted" />
      </div>
      <Status variant="pending">プロフィールを読み込んでいます。</Status>
    </main>
  );
}

export { ProfilePending };
