import { assertEligibleUser, deny } from "./policy.ts";
import { jwt, twoFactor } from "better-auth/plugins";
import type { Application } from "@template/config";
import type { BetterAuthOptions } from "better-auth";
import type { Database } from "@template/db";
import { findPasskeyUser } from "@template/db/security";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import { wikiScopes } from "./mcp.ts";

type AuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

function verificationAudiencePlugin(audience: Application): AuthPlugin {
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
}

function passkeyPlugin(
  origin: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  database: Database,
  audience: Application,
): ReturnType<typeof passkey> {
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
        assertEligibleUser(await findPasskeyUser(database, clientData.id, audience), audience);
      },
    },
    authenticatorSelection: { userVerification: "required" },
    origin,
    rpID: new URL(origin).hostname,
  });
}

function wikiAuthorizationServer(origin: string): AuthPlugin[] {
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
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function authPlugins({
  audience,
  database,
  origin,
}: Readonly<{ audience: Application; database: Database; origin: string }>): AuthPlugin[] {
  return [
    verificationAudiencePlugin(audience),
    twoFactor({ issuer: "TypeScript Template", skipVerificationOnEnable: false }),
    passkeyPlugin(origin, database, audience),
    ...(audience === "wiki" ? wikiAuthorizationServer(origin) : []),
  ];
}

export { authPlugins };
