import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@template/runtime/http";
import { wikiProtocol } from "#/server-api/index.ts";

const Route = createFileRoute("/mcp")({ server: elysiaServer(wikiProtocol) });

export { Route };
