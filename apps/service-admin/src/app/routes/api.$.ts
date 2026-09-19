import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { adminApi } from "#shared/server-api/index.ts";

const Route = createFileRoute("/api/$")({ server: elysiaServer(adminApi) });

export { Route };
