import { findWikiReader, mcpAuthorizer, mcpJsonRpcError } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { createInsufficientScopeError } from "better-auth/oauth2";
import { Effect, Option } from "effect";

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
  scopeError: (granted) => {
    const missing = requiredScopes.filter((required) => !granted.has(required));
    return missing.length > 0 ? Option.some(createInsufficientScopeError(missing)) : Option.none();
  },
});

export { authorizeMcpRequest };
