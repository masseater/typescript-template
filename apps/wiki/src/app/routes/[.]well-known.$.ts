import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { wikiProtocol } from "#shared/server-api/index.ts";

const Route = createFileRoute("/.well-known/$")({ server: elysiaServer(wikiProtocol) });

export { Route };
