import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@template/runtime/http";
import { userApi } from "#api.ts";

const Route = createFileRoute("/api/$")({ server: elysiaServer(userApi) });

export { Route };
