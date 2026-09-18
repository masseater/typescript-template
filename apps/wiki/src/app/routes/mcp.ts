import { createFileRoute } from "@tanstack/react-router";
import { elysiaServer } from "@repo/runtime/http";
import { wikiProtocol } from "#shared/server-api/index.ts";

const Route = createFileRoute("/mcp")({ server: elysiaServer(wikiProtocol) });

export { Route };
