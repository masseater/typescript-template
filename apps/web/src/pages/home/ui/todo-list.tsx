import { useAtomValue } from "@effect/atom-react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { todoQueries } from "../api/queries";
import { todoFilterAtom } from "../model/filter";
import { FilterTabs } from "./filter-tabs";
import { TodoItem } from "./todo-item";

export function TodoList() {
  const { data } = useSuspenseQuery(todoQueries.api.todos.get.queryOptions());
  const filter = useAtomValue(todoFilterAtom);
  const visible = data.filter((item) => filter === "all" || item.status === filter);
  return (
    <section className="flex flex-col gap-4">
      <FilterTabs />
      <ul>
        {visible.map((item) => (
          <TodoItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
