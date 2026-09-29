import { createFileRoute } from "@tanstack/react-router";

import { todoQueries } from "#/entities/todo";
import { HomePage } from "#/pages/home";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(todoQueries.api.todos.get.queryOptions()),
  component: HomePage,
});
