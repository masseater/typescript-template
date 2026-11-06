import { routeHandlers } from "@r_masseater/workers-tracing/elysia";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "#/app/server/api.server";

const Route = createFileRoute("/api/$")({
  server: { handlers: routeHandlers(api.handle) },
});

export { Route };
