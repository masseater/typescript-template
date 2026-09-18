import { createFileRoute } from "@tanstack/react-router";

import { wikiProtocol } from "#shared/server-api/index.ts";
import { elysiaServer } from "@template/runtime/http";

const Route = createFileRoute("/mcp")({ server: elysiaServer(wikiProtocol) });

export { Route };
