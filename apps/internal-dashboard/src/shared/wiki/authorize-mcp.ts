import { findWikiReader, mcpAuthorization, mcpForbidden } from "@repo/auth";
import { Effect } from "effect";

import type { McpTokenClaims } from "@repo/auth";

const wikiReadScope = "wiki:read";

const readerFor = Effect.fn("readerFor")(function* readerFor({ sub }: McpTokenClaims) {
  const reader = sub === undefined ? undefined : yield* findWikiReader(sub);
  return reader ? { userId: reader.id } : mcpForbidden("WIKI_READER_REQUIRED");
});

const authorizeMcpRequest = mcpAuthorization({
  actor: readerFor,
  challengeScopes: [wikiReadScope],
  toolScopes: [wikiReadScope],
});

export { authorizeMcpRequest };
