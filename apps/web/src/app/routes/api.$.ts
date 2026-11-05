import { tracedHandle } from "@r_masseater/workers-tracing/elysia";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "#/app/server/api.server";

const handleApi = tracedHandle(api.handle);

const handle = ({ request }: Readonly<{ request: Request }>): Promise<Response> =>
  handleApi(request);

const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle },
  },
});

export { Route };
