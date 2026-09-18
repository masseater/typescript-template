import { createFileRoute } from "@tanstack/react-router";

import { wikiApi } from "#shared/server-api/index.ts";
import { elysiaServer } from "@template/runtime/http";

const Route = createFileRoute("/api/$")({ server: elysiaServer(wikiApi) });

export { Route };
