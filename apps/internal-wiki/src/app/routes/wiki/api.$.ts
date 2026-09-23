import { elysiaServer } from "@repo/runtime/http";
import { createFileRoute } from "@tanstack/react-router";

import { searchApi } from "#shared/server-api/index.ts";

const Route = createFileRoute("/wiki/api/$")({ server: elysiaServer(searchApi) });

export { Route };
