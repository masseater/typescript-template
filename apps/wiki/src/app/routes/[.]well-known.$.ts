import { createFileRoute } from "@tanstack/react-router";

import { wikiProtocol } from "#shared/server-api/index.ts";
import { elysiaServer } from "@template/runtime/http";

const Route = createFileRoute("/.well-known/$")({ server: elysiaServer(wikiProtocol) });

export { Route };
