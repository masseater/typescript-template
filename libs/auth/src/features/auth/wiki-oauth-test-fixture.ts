import { APPLICATION } from "@repo/config";
import { Effect } from "effect";

import { bootstrapVerifiedStaff, enableTotp, signInAs } from "./auth-test-fixture.ts";
import { origins } from "./browser-client-test-fixture.ts";
import { startOAuthAuthorization } from "./oauth-authorization-test-fixture.ts";

const wikiOrigin = origins[APPLICATION.wiki];

const wikiStaff = Effect.fn("wikiStaff")(function* wikiStaff(email: string) {
  yield* bootstrapVerifiedStaff(email);
  const client = yield* signInAs(APPLICATION.wiki, email);
  yield* enableTotp(client);
  return client;
});

const startWikiAuthorization = () =>
  startOAuthAuthorization({
    application: APPLICATION.wiki,
    clientName: "Test MCP client",
    redirectUri: "http://127.0.0.1:43123/callback",
    scope: "wiki:read offline_access",
  });

export { startWikiAuthorization, wikiStaff, wikiOrigin };
