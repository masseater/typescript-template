import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { memberProtocol } from "#shared/server-api/index.ts";

const Route = createFileRoute("/mcp")({ server: elysiaServer(memberProtocol) });

export { Route };
