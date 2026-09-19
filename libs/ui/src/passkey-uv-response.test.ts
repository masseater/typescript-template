import { loopbackOrigin } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";
import "@repo/dont-review-it/vitest/parsed-fields";

import { passkeyUVResponse } from "./passkey-uv-response.ts";

const servedPort = 4173;
const servedOrigin = loopbackOrigin(servedPort);
const authenticateOptionsUrl = `${servedOrigin}/api/auth/passkey/generate-authenticate-options`;
const registerOptionsUrl = `${servedOrigin}/api/auth/passkey/generate-register-options`;
const sessionUrl = `${servedOrigin}/api/auth/get-session`;
const okStatus = 200;
const forbiddenStatus = 403;

describe("passkey option responses", () => {
  const it = test
    .extend("theServedAuthenticationOptions", async () =>
      passkeyUVResponse(
        Response.json(
          { challenge: "challenge", userVerification: "preferred" },
          { headers: { "x-served-by": "passkey" }, status: okStatus, statusText: "OK" },
        ),
        authenticateOptionsUrl,
      ))
    .extend("theServedRegistrationOptions", async () =>
      passkeyUVResponse(
        Response.json(
          { authenticatorSelection: { residentKey: "required", userVerification: "discouraged" } },
          { status: okStatus },
        ),
        registerOptionsUrl,
      ),
    )
    .extend("theServedRegistrationOptionsWithoutASelection", async () =>
      passkeyUVResponse(
        Response.json({ challenge: "challenge" }, { status: okStatus }),
        registerOptionsUrl,
      ),
    )
    .extend("theServedRefusal", async () =>
      passkeyUVResponse(
        Response.json({ error: "denied" }, { status: forbiddenStatus }),
        registerOptionsUrl,
      ),
    )
    .extend("theServedSession", async () =>
      passkeyUVResponse(Response.json({ strong: true }, { status: okStatus }), sessionUrl),
    );

  it("requires user verification of the authentication options", async ({
    theServedAuthenticationOptions,
  }) => {
    await expect(theServedAuthenticationOptions).toHaveParsedFields({
      body: { challenge: "challenge", userVerification: "required" },
      headers: { "content-type": "application/json", "x-served-by": "passkey" },
      status: okStatus,
    });
  });

  it("requires user verification of the registration options", async ({
    theServedRegistrationOptions,
  }) => {
    await expect(theServedRegistrationOptions).toHaveParsedFields({
      body: { authenticatorSelection: { residentKey: "required", userVerification: "required" } },
      headers: { "content-type": "application/json" },
      status: okStatus,
    });
  });

  it("requires user verification where the server named no authenticator", async ({
    theServedRegistrationOptionsWithoutASelection,
  }) => {
    await expect(theServedRegistrationOptionsWithoutASelection).toHaveParsedFields({
      body: { authenticatorSelection: { userVerification: "required" }, challenge: "challenge" },
      headers: { "content-type": "application/json" },
      status: okStatus,
    });
  });

  it("hands back a refused options response as the server wrote it", async ({
    theServedRefusal,
  }) => {
    await expect(theServedRefusal).toHaveParsedFields({
      body: { error: "denied" },
      headers: { "content-type": "application/json" },
      status: forbiddenStatus,
    });
  });

  it("hands back a response of another path as the server wrote it", async ({
    theServedSession,
  }) => {
    await expect(theServedSession).toHaveParsedFields({
      body: { strong: true },
      headers: { "content-type": "application/json" },
      status: okStatus,
    });
  });
});
