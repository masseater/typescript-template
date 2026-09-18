import type { ReactElement } from "react";

import type { Task } from "#shared/contract/index.ts";

function TaskThread({ thread }: Readonly<{ thread: (typeof Task.Type)["thread"] }>): ReactElement {
  return (
    <ul aria-label="コメント" className="flex flex-col gap-2">
      {thread.map((entry) => (
        <li key={entry.id} className="flex flex-col">
          <span className="text-sm text-muted-foreground">
            {entry.author}・{new Date(entry.createdAt).toLocaleString("ja-JP")}
          </span>
          <span className="whitespace-pre-wrap text-foreground">{entry.text}</span>
        </li>
      ))}
    </ul>
  );
}

export { TaskThread };
