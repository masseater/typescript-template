import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@template/runtime/http";
import { wikiProtocol } from "#/api.ts";

const Route = createFileRoute("/.well-known/$")({ server: elysiaServer(wikiProtocol) });

export { Route };
