import { adminApi } from "#api.ts";
import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@template/runtime/http";

const Route = createFileRoute("/api/$")({ server: elysiaServer(adminApi) });

export { Route };
