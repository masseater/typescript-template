import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import { APPLICATION, type Application } from "@repo/config";
import { findPasskeyUser } from "@repo/db";
import { jwt, twoFactor } from "better-auth/plugins";

import { memberApiKeyPlugin } from "./member-api-key-options.ts";
import { passkeyRpId } from "./passkey-rp-id.ts";
import { assertEligibleUser, deny } from "./policy.ts";
import { wikiScopes } from "./scopes.ts";

import type { BetterAuthOptions } from "better-auth";
import type { Run } from "./runner.ts";

type AuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

const verificationAudiencePlugin = (audience: Application): AuthPlugin => {
  const audienceField = {
    defaultValue: audience,
    input: false,
    required: true,
    type: "string",
  } as const;
  return {
    id: "verification-audience",
    schema: {
      passkey: { fields: { audience: audienceField } },
      verification: { fields: { audience: audienceField } },
    },
  };
};

const passkeyPlugin = ({
  audience,
  origin,
  run,
}: Readonly<{ audience: Application; origin: string; run: Run }>): ReturnType<typeof passkey> => {
  return passkey({
    authentication: {
      afterVerification: async ({
        clientData,
        verification,
      }: Readonly<{
        clientData: Readonly<{ id: string }>;
        verification: Readonly<{ authenticationInfo: Readonly<{ userVerified: boolean }> }>;
      }>) => {
        if (!verification.authenticationInfo.userVerified) {
          deny("PASSKEY_UV_REQUIRED");
        }
        const passkeyOwner = await run(findPasskeyUser(clientData.id, audience));
        assertEligibleUser(passkeyOwner, audience);
      },
    },
    authenticatorSelection: { userVerification: "required" },
    origin,
    rpID: passkeyRpId(origin),
  });
};

const wikiAuthorizationServer = (origin: string): AuthPlugin[] => {
  return [
    jwt({ disableSettingJwtHeader: true }),
    mcp({
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationAllowedScopes: [...wikiScopes],
      clientRegistrationDefaultScopes: [...wikiScopes],
      consentPage: "/consent",
      loginPage: "/login",
      resource: `${origin}/mcp`,
      scopes: [...wikiScopes],
    }),
  ];
};

const authPlugins = ({
  audience,
  origin,
  run,
}: Readonly<{ audience: Application; origin: string; run: Run }>): AuthPlugin[] => {
  return [
    verificationAudiencePlugin(audience),
    twoFactor({ issuer: "TypeScript Template", skipVerificationOnEnable: false }),
    passkeyPlugin({ audience, origin, run }),
    ...(audience === APPLICATION.user ? [memberApiKeyPlugin()] : []),
    ...(audience === APPLICATION.wiki ? wikiAuthorizationServer(origin) : []),
  ];
};

export { authPlugins };
