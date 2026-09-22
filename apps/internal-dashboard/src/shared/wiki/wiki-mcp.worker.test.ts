import { APPLICATION, ROLE } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  AuthApps,
  PASSWORD,
  assignRoleByEmail,
  assignRoleById,
  authTest,
  bootstrapVerifiedAdmin,
  clientOf,
  registerVerified,
  signIn,
  signInAs,
} from "../../../../../libs/auth/src/testing.ts";
import {
  exchangeCode,
  grantAuthorization,
  mcpRequest,
  responseStatus,
  startAuthorization,
  wikiAdministrator,
  wikiOrigin,
} from "./wiki-oauth-fixture.ts";

const tamperedSuffix = "xx";

const discovery = Effect.fn("discovery")(function* discovery(path: string) {
  const wiki = (yield* AuthApps)[APPLICATION.wiki];
  const response = yield* Effect.promise(() =>
    wiki.instance.handler(new Request(`${wikiOrigin}${path}`)),
  );
  const body = yield* Effect.promise(() => response.json() as Promise<unknown>);
  return { body, status: response.status };
});

const authorizedTokens = Effect.fn("authorizedTokens")(function* authorizedTokens() {
  const flow = yield* startAuthorization();
  const wiki = yield* wikiAdministrator("owner@example.com");
  const code = yield* grantAuthorization(wiki, flow.oauthQuery);
  return { tokens: yield* exchangeCode(flow, code), wiki };
});

describe("wiki MCP authorization", () => {
  authTest("wiki publishes OAuth discovery for its MCP resource", ({ auth }) =>
    Effect.runPromise(
      Effect.gen(function* discoverOAuth() {
        const result = yield* Effect.gen(function* program() {
          const resource = yield* discovery("/.well-known/oauth-protected-resource/mcp");
          const server = yield* discovery("/.well-known/oauth-authorization-server/api/auth");
          const challenge = yield* mcpRequest();
          const header =
            challenge instanceof Response ? challenge.headers.get("www-authenticate") : "";
          return {
            challengeStatus: responseStatus(challenge),
            header: header ?? "",
            resource,
            server,
          };
        }).pipe(Effect.provideContext(auth));
        expect(result.resource.status).toBe(httpStatus.ok);
        expect(result.resource.body).toMatchObject({
          authorization_servers: [`${wikiOrigin}/api/auth`],
          resource: `${wikiOrigin}/mcp`,
        });
        expect(result.server.body).toMatchObject({
          code_challenge_methods_supported: ["S256"],
          issuer: `${wikiOrigin}/api/auth`,
          registration_endpoint: `${wikiOrigin}/api/auth/oauth2/register`,
        });
        expect(result.challengeStatus).toBe(httpStatus.unauthorized);
        expect(result.header).toContain(
          `resource_metadata="${wikiOrigin}/.well-known/oauth-protected-resource/mcp"`,
        );
      }),
    ),
  );

  authTest(
    "strong wiki administrator authorizes an MCP client that can then read the wiki",
    ({ auth }) =>
      Effect.runPromise(
        Effect.gen(function* authorizeClient() {
          const result = yield* Effect.gen(function* program() {
            const { tokens } = yield* authorizedTokens();
            const granted = yield* mcpRequest(tokens.access_token);
            const token = tokens.access_token;
            const tampered = `${token.slice(0, token.length - tamperedSuffix.length)}${tamperedSuffix}`;
            return {
              grantedUserId: granted instanceof Response ? "" : granted.userId,
              tamperedStatus: responseStatus(yield* mcpRequest(tampered)),
            };
          }).pipe(Effect.provideContext(auth));
          expect(result.grantedUserId).toMatch(/^.+$/u);
          expect(result.tamperedStatus).toBe(httpStatus.unauthorized);
        }),
      ),
  );

  authTest("demoted administrator loses MCP access even with an unexpired token", ({ auth }) =>
    Effect.runPromise(
      Effect.gen(function* demoteAdministrator() {
        const result = yield* Effect.gen(function* program() {
          const { tokens, wiki } = yield* authorizedTokens();
          const owner = yield* wiki.verify();
          yield* registerVerified("second@example.com");
          yield* assignRoleByEmail("second@example.com", ROLE.administrator);
          yield* assignRoleById(owner.user.id, ROLE.member);
          return {
            mcpStatus: responseStatus(yield* mcpRequest(tokens.access_token)),
            sessionTag: yield* Effect.flip(wiki.verify()).pipe(Effect.map((error) => error._tag)),
          };
        }).pipe(Effect.provideContext(auth));
        expect(result.sessionTag).toBe("SessionRequired");
        expect(result.mcpStatus).toBe(httpStatus.forbidden);
      }),
    ),
  );

  authTest("weak or non-administrator wiki sessions cannot grant MCP access", ({ auth }) =>
    Effect.runPromise(
      Effect.gen(function* refuseWeakGrant() {
        const result = yield* Effect.gen(function* program() {
          const flow = yield* startAuthorization();
          yield* bootstrapVerifiedAdmin("owner@example.com");
          const weak = yield* signInAs(APPLICATION.wiki, "owner@example.com");
          const continued = yield* weak.json("/oauth2/continue", {
            oauth_query: flow.oauthQuery,
            postLogin: true,
          });
          const smuggled = yield* (yield* clientOf(APPLICATION.wiki)).json("/sign-in/email", {
            email: "owner@example.com",
            oauth_query: flow.oauthQuery,
            password: PASSWORD,
          });
          return { continued, smuggled };
        }).pipe(Effect.provideContext(auth));
        expect(result.continued).toStrictEqual({
          body: { message: "ADMIN_MFA_REQUIRED" },
          status: httpStatus.forbidden,
        });
        expect(result.smuggled).toStrictEqual({
          body: { message: "OAUTH_QUERY_NOT_ACCEPTED" },
          status: httpStatus.forbidden,
        });
      }),
    ),
  );

  authTest("non-administrator wiki members cannot sign in or sign up", ({ auth }) =>
    Effect.runPromise(
      Effect.gen(function* refuseMemberSignIn() {
        const result = yield* Effect.gen(function* program() {
          yield* registerVerified("member@example.com");
          const member = yield* clientOf(APPLICATION.wiki);
          const signInStatus = yield* signIn(member, "member@example.com");
          const signUpStatus = yield* member.status("/sign-up/email", {
            email: "new@example.com",
            name: "new",
            password: PASSWORD,
          });
          return { signInStatus, signUpStatus };
        }).pipe(Effect.provideContext(auth));
        expect(result.signInStatus).not.toBe(httpStatus.ok);
        expect(result.signUpStatus).not.toBe(httpStatus.ok);
      }),
    ),
  );
});
