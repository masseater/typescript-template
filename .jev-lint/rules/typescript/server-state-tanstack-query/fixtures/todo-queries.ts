import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "#/shared/api";

type Todo = { id: string; title: string; done: boolean };

const todosQuery = queryOptions({
  queryKey: ["todos"],
  queryFn: async (): Promise<readonly Todo[]> => {
    const { data, error } = await api.todos.get();
    if (error) {
      throw error;
    }
    return data;
  },
});

const useTodos = (): readonly Todo[] => useSuspenseQuery(todosQuery).data;

export type { Todo };
export { todosQuery, useTodos };
