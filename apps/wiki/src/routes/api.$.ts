import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@template/runtime/http";
import { wikiApi } from "#/server-api/index.ts";

const Route = createFileRoute("/api/$")({ server: elysiaServer(wikiApi) });

export { Route };
