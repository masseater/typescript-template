import { insufficientScopeError, mcpAuthorizer, mcpJsonRpcError } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { findWikiReader } from "@repo/db";
import { Effect } from "effect";

const requiredScopes = ["wiki:read"];

const authorizeMcpRequest = mcpAuthorizer({
  actorOf: (subject) =>
    Effect.gen(function* readerFor() {
      const { sub } = subject;
      const reader = sub === undefined ? undefined : yield* findWikiReader(sub);
      return reader
        ? { userId: reader.id }
        : mcpJsonRpcError({ message: "WIKI_READER_REQUIRED", status: httpStatus.forbidden });
    }),
  challengeScopes: requiredScopes,
  scopeError: (granted) => insufficientScopeError(requiredScopes, granted),
});

export { authorizeMcpRequest };
