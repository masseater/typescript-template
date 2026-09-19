import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { userApi } from "#shared/server-api/index.ts";

const Route = createFileRoute("/api/$")({ server: elysiaServer(userApi) });

export { Route };
