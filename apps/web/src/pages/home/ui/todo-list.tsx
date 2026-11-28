import { useSuspenseQuery } from "@tanstack/react-query";
import { Array, pipe } from "effect";
import type { ReactNode } from "react";

import { todoQueries } from "#/pages/home/api/queries";
import { useTodoFilter } from "#/pages/home/model/filter";

import { FilterTabs } from "./filter-tabs.tsx";
import { TodoItem } from "./todo-item.tsx";

export const TodoList = (): ReactNode => {
  const { data } = useSuspenseQuery(todoQueries.api.todos.get.queryOptions());
  const filter = useTodoFilter();
  const visible = pipe(
    data,
    Array.filter((item) => filter === "all" || item.status === filter),
  );
  return (
    <section className="flex flex-col gap-4">
      <FilterTabs />
      <ul>
        {pipe(
          visible,
          Array.map((item) => <TodoItem key={item.id} item={item} />),
        )}
      </ul>
    </section>
  );
};
