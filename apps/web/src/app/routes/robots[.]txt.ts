import { createFileRoute } from "@tanstack/react-router";
import { Array, Option, pipe } from "effect";

import { SEARCH_INDEX_ORIGIN, SITEMAP_FILE } from "#/shared/config";

const body = pipe(
  [
    "User-agent: *",
    "Allow: /",
    ...Option.match(SEARCH_INDEX_ORIGIN, {
      onNone: () => [],
      onSome: (origin) => ["", `Sitemap: ${new URL(SITEMAP_FILE, origin).href}`],
    }),
    "",
  ],
  Array.join("\n"),
);

const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
    },
  },
});

export { Route };
