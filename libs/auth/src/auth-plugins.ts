import { assertEligibleUser, deny } from "./policy.ts";
import { jwt, twoFactor } from "better-auth/plugins";
import type { Application } from "@repo/config";
import type { BetterAuthOptions } from "better-auth";
import type { Run } from "./runner.ts";
import { findPasskeyUser } from "@repo/db/security";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import { wikiScopes } from "./scopes.ts";

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
  run: Run,
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
        const user = await run(findPasskeyUser(clientData.id, audience));
        assertEligibleUser(user ?? undefined, audience);
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

function authPlugins({
  audience,
  origin,
  run,
}: Readonly<{ audience: Application; origin: string; run: Run }>): AuthPlugin[] {
  return [
    verificationAudiencePlugin(audience),
    twoFactor({ issuer: "TypeScript Template", skipVerificationOnEnable: false }),
    passkeyPlugin(origin, run, audience),
    ...(audience === "wiki" ? wikiAuthorizationServer(origin) : []),
  ];
}

export { authPlugins };
