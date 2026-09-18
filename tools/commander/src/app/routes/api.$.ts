import { createFileRoute } from "@tanstack/react-router";

import { api } from "#shared/server-api/index.ts";
import { elysiaServer } from "@repo/runtime/http";

const Route = createFileRoute("/api/$")({ server: elysiaServer(api) });

export { Route };
