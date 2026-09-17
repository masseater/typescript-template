import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@template/runtime/http";
import { wikiApi } from "#/api.ts";

const Route = createFileRoute("/api/$")({ server: elysiaServer(wikiApi) });

export { Route };
