import { cn } from "#/shared/lib/utils";

import type { todo } from "../model/todo.table";

export function TodoItem({ item }: { item: typeof todo.$inferSelect }) {
  return (
    <li className={cn("py-1", item.status === "done" && "text-muted-foreground line-through")}>
      {item.title}
    </li>
  );
}
