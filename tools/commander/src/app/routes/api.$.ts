import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "#shared/server-api/index.ts";

const Route = createFileRoute("/api/$")({ server: elysiaServer(api) });

export { Route };
