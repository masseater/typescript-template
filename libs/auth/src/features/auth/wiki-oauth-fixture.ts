import { APPLICATION } from "@repo/config";
import { Effect } from "effect";

import { bootstrapVerifiedStaff, enableTotp, signInAs } from "./auth-test-fixture.ts";
import { origins } from "./browser-client.ts";
import { startClientAuthorization } from "./oauth-client-fixture.ts";

const wikiOrigin = origins[APPLICATION.wiki];
const redirectUri = "http://127.0.0.1:43123/callback";

const wikiStaff = Effect.fn("wikiStaff")(function* wikiStaff(email: string) {
  yield* bootstrapVerifiedStaff(email);
  const client = yield* signInAs(APPLICATION.wiki, email);
  yield* enableTotp(client);
  return client;
});

const startAuthorization = Effect.fn("startAuthorization")(function* startAuthorization() {
  return yield* startClientAuthorization({
    application: APPLICATION.wiki,
    clientName: "Test MCP client",
    redirectUri,
    scope: "wiki:read offline_access",
  });
});

export { redirectUri, startAuthorization, wikiOrigin, wikiStaff };
