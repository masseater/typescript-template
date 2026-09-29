import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../server/api.server";

const handle = ({ request }: { request: Request }) => api.handle(request);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle },
  },
});
