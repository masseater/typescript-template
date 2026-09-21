import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { userProtocol } from "#shared/server-api/index.ts";

const Route = createFileRoute("/.well-known/$")({ server: elysiaServer(userProtocol) });

export { Route };
