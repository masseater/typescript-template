import type { ReactElement } from "react";
import { Status } from "@template/ui";
import { UsersBody } from "./users-body.tsx";

const placeholders = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

function UsersPending(): ReactElement {
  return (
    <UsersBody>
      <Status variant="pending">ユーザーを読み込んでいます。</Status>
      <ul aria-hidden="true" className="flex flex-col gap-4">
        {placeholders.map((name) => (
          <li key={name} className="h-20 rounded-lg border border-border bg-muted" />
        ))}
      </ul>
    </UsersBody>
  );
}

export { UsersPending };
