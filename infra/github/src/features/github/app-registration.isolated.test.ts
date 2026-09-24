import { gitHubApiOrigin, httpStatus } from "@repo/config";
import { gitHubAppKeyFixture } from "@repo/config/testing";
import { Deferred, Effect, Fiber, Redacted, Ref, Result, Schema } from "effect";
import { FetchHttpClient, HttpClient, type HttpClientResponse } from "effect/unstable/http";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { ensureInstallation, uninstall } from "./app-installation.ts";
import { type AppDefinition, registerApp, replacesApp } from "./app-registration.ts";

const appId = 4242;
const slug = "acme-wiki-publisher";
const htmlUrl = `https://github.com/apps/${slug}`;
const installationId = 31;
const operatorToken = "gho_operator_fixture";
const acceptedCode = "manifest-code";
const definition: AppDefinition = {
  name: "acme wiki publisher",
  owner: "acme",
  permissions: { contents: "write", pull_requests: "write" },
  repository: "widgets",
  url: "https://github.com/acme/widgets",
};
const repositoryApi = `${gitHubApiOrigin}/repos/acme/widgets`;
const installUrl = `https://github.com/apps/${slug}/installations/new/permissions?suggested_target_id=9&repository_ids[]=77`;
const openingNotice = "Open <origin>/ to create the GitHub App";
const installNotice = `Install the GitHub App on acme/widgets: ${installUrl}`;
const notInstalledNotice = "The GitHub App is not installed yet; install it and deploy again";
const localOrigin = /http:\/\/127\.0\.0\.1:\d+/u;
const createdManifest = {
  default_events: [],
  default_permissions: definition.permissions,
  hook_attributes: { active: false, url: definition.url },
  name: definition.name,
  public: false,
  redirect_url: "<origin>/created",
  url: definition.url,
};
const createdApp = { appId, htmlUrl, installationId, privateKeyStored: true, slug };
const strayAnswers = [httpStatus.badRequest, httpStatus.badRequest, httpStatus.badRequest];

describe("registerApp", () => {
  describe.for([
    [
      "an operator who opens the page and installs the App on the second check",
      { code: acceptedCode, installedAfter: 1, owner: "User", repository: "owned" },
      {
        announcements: [openingNotice, installNotice],
        app: createdApp,
        browser: {
          action: "https://github.com/settings/apps/new?state=<state>",
          created: { location: installUrl, status: httpStatus.found },
          manifest: createdManifest,
          strays: strayAnswers,
        },
        failure: undefined,
        pollsBeyondFirst: true,
      },
    ],
    [
      "a repository owned by an organization",
      { code: acceptedCode, installedAfter: 0, owner: "Organization", repository: "owned" },
      {
        announcements: [openingNotice, installNotice],
        app: createdApp,
        browser: {
          action: "https://github.com/organizations/acme/settings/apps/new?state=<state>",
          created: { location: installUrl, status: httpStatus.found },
          manifest: createdManifest,
          strays: strayAnswers,
        },
        failure: undefined,
        pollsBeyondFirst: false,
      },
    ],
    [
      "a manifest code GitHub no longer accepts",
      { code: "expired-code", installedAfter: 0, owner: "User", repository: "owned" },
      {
        announcements: [openingNotice],
        app: undefined,
        browser: {
          action: "https://github.com/settings/apps/new?state=<state>",
          created: { location: undefined, status: httpStatus.serviceUnavailable },
          manifest: createdManifest,
          strays: strayAnswers,
        },
        failure: {
          caused: false,
          code: "github_refused",
          status: httpStatus.notFound,
          step: "conversion",
        },
        pollsBeyondFirst: false,
      },
    ],
    [
      "an operator who never installs the App",
      {
        code: acceptedCode,
        installedAfter: Number.POSITIVE_INFINITY,
        owner: "User",
        repository: "owned",
      },
      {
        announcements: [openingNotice, installNotice, notInstalledNotice],
        app: { ...createdApp, installationId: undefined },
        browser: {
          action: "https://github.com/settings/apps/new?state=<state>",
          created: { location: installUrl, status: httpStatus.found },
          manifest: createdManifest,
          strays: strayAnswers,
        },
        failure: undefined,
        pollsBeyondFirst: true,
      },
    ],
    [
      "an operator who never opens the page",
      { code: undefined, installedAfter: 0, owner: "User", repository: "owned" },
      {
        announcements: [openingNotice],
        app: undefined,
        browser: undefined,
        failure: { caused: false, code: "manifest_timeout", status: undefined, step: "manifest" },
        pollsBeyondFirst: false,
      },
    ],
    [
      "GitHub out of reach",
      { code: undefined, installedAfter: 0, owner: "User", repository: "unreachable" },
      {
        announcements: [],
        app: undefined,
        browser: undefined,
        failure: {
          caused: true,
          code: "github_unreachable",
          status: undefined,
          step: "repository",
        },
        pollsBeyondFirst: false,
      },
    ],
    [
      "GitHub answering with something that is not a repository",
      { code: undefined, installedAfter: 0, owner: "User", repository: "malformed" },
      {
        announcements: [],
        app: undefined,
        browser: undefined,
        failure: {
          caused: true,
          code: "github_refused",
          status: httpStatus.ok,
          step: "repository",
        },
        pollsBeyondFirst: false,
      },
    ],
  ] as const)("%s", ([, scenario, promisedReport]) => {
    const it = test.extend("registrationReport", ({}, { onCleanup }) =>
      Effect.gen(function* registrationReport() {
        const appKey = yield* gitHubAppKeyFixture("pkcs1");
        const services = yield* Effect.context();
        const installationChecks = yield* Ref.make(0);
        const gitHubApi = setupServer(
          http.get(repositoryApi, ({ request: incoming }) => {
            if (scenario.repository === "unreachable") {
              return HttpResponse.error();
            }
            if (scenario.repository === "malformed") {
              return HttpResponse.json({ id: "77" });
            }
            return incoming.headers.get("authorization") === `Bearer ${operatorToken}`
              ? HttpResponse.json({ id: 77, owner: { id: 9, type: scenario.owner } })
              : HttpResponse.json({}, { status: httpStatus.unauthorized });
          }),
          http.post(`${gitHubApiOrigin}/app-manifests/:code/conversions`, ({ params }) =>
            params.code === acceptedCode
              ? HttpResponse.json(
                  { html_url: htmlUrl, id: appId, pem: appKey.privateKey, slug },
                  { status: httpStatus.created },
                )
              : HttpResponse.json({}, { status: httpStatus.notFound }),
          ),
          http.get(`${repositoryApi}/installation`, ({ request: incoming }) =>
            Effect.runPromiseWith(services)(
              Effect.gen(function* answerInstallation() {
                const signed = yield* Effect.promise(() =>
                  appKey.signedBy(incoming.headers.get("authorization"), String(appId)),
                );
                const checks = yield* Ref.updateAndGet(
                  installationChecks,
                  (checkCount) => checkCount + 1,
                );
                return signed && checks > scenario.installedAfter
                  ? HttpResponse.json({ id: installationId })
                  : HttpResponse.json({}, { status: httpStatus.notFound });
              }),
            ),
          ),
        );
        gitHubApi.listen({
          onUnhandledRequest: (unhandled, print) => {
            if (!localOrigin.test(unhandled.url)) {
              print.error();
            }
          },
        });
        onCleanup(() => {
          gitHubApi.close();
        });
        const announcements = yield* Ref.make<readonly string[]>([]);
        const firstAnnouncement = yield* Deferred.make<string>();
        const registering = yield* Effect.forkChild(
          Effect.result(
            registerApp(definition, {
              manifestTimeout: scenario.code === undefined ? "50 millis" : "10 seconds",
              token: Redacted.make(operatorToken),
              wait: {
                announce: (line) =>
                  Ref.update(announcements, (announced) => [...announced, line]).pipe(
                    Effect.andThen(Deferred.succeed(firstAnnouncement, line)),
                    Effect.asVoid,
                  ),
                pollInterval: "10 millis",
                timeout: "150 millis",
              },
            }),
          ),
        );
        const browse = (url: string): Effect.Effect<HttpClientResponse.HttpClientResponse> =>
          HttpClient.get(url).pipe(
            Effect.provide(FetchHttpClient.layer),
            Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
            Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
            Effect.orDie,
          );
        const opening = scenario.code === undefined ? "" : yield* Deferred.await(firstAnnouncement);
        const origin = localOrigin.exec(opening)?.[0] ?? "";
        const browser =
          scenario.code === undefined
            ? undefined
            : yield* Effect.gen(function* visitManifestPage() {
                const markup = yield* browse(`${origin}/`).pipe(
                  Effect.flatMap((page) => page.text),
                  Effect.orDie,
                );
                const action = /action="([^"]+)"/u.exec(markup)?.[1] ?? "";
                const manifestState = new URL(action).searchParams.get("state") ?? "";
                const strays = yield* Effect.forEach(
                  [
                    `${origin}/favicon.ico`,
                    `${origin}/created?code=${scenario.code}&state=forged`,
                    `${origin}/created?state=${manifestState}`,
                  ],
                  (url) => browse(url).pipe(Effect.map((page) => page.status)),
                );
                const redirect = yield* browse(
                  `${origin}/created?code=${scenario.code}&state=${manifestState}`,
                );
                return {
                  action: action.replace(manifestState, "<state>"),
                  created: { location: redirect.headers.location, status: redirect.status },
                  manifest: yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(
                    (/name="manifest" value="([^"]+)"/u.exec(markup)?.[1] ?? "")
                      .replaceAll("&quot;", '"')
                      .replaceAll(origin, "<origin>"),
                  ).pipe(Effect.orDie),
                  strays,
                };
              });
        const registered = yield* Fiber.join(registering);
        return {
          announcements: (yield* Ref.get(announcements)).map((line) =>
            line.replace(localOrigin, "<origin>"),
          ),
          app: Result.isSuccess(registered)
            ? {
                appId: registered.success.appId,
                htmlUrl: registered.success.htmlUrl,
                installationId: registered.success.installationId,
                privateKeyStored:
                  Redacted.value(registered.success.privateKey) === appKey.privateKey,
                slug: registered.success.slug,
              }
            : undefined,
          browser,
          failure: Result.isFailure(registered)
            ? {
                caused: registered.failure.cause !== undefined,
                code: registered.failure.code,
                status: registered.failure.status,
                step: registered.failure.step,
              }
            : undefined,
          pollsBeyondFirst: (yield* Ref.get(installationChecks)) > 1,
        };
      }).pipe(Effect.scoped, Effect.runPromise));

    it("reports what the operator and the browser saw", ({ registrationReport }) => {
      expect(registrationReport).toStrictEqual(promisedReport);
    });
  });
});

describe("ensureInstallation", () => {
  describe.for([
    [
      "an App already installed on the repository",
      { installedAfter: 0, signingKey: "issued" },
      { announcements: [], failure: undefined, installed: installationId },
    ],
    [
      "an App not installed yet",
      { installedAfter: 1, signingKey: "issued" },
      { announcements: [installNotice], failure: undefined, installed: installationId },
    ],
    [
      "an App whose key GitHub does not recognise",
      { installedAfter: 0, signingKey: "foreign" },
      {
        announcements: [],
        failure: {
          caused: false,
          code: "github_refused",
          status: httpStatus.unauthorized,
          step: "installation",
        },
        installed: undefined,
      },
    ],
    [
      "an App whose stored key cannot sign",
      { installedAfter: 0, signingKey: "broken" },
      {
        announcements: [],
        failure: { caused: true, code: "private_key_invalid", status: undefined, step: "jwt" },
        installed: undefined,
      },
    ],
  ] as const)("%s", ([, scenario, promisedReport]) => {
    const it = test.extend("installationReport", ({}, { onCleanup }) =>
      Effect.gen(function* installationReport() {
        const appKey = yield* gitHubAppKeyFixture("pkcs1");
        const services = yield* Effect.context();
        const foreignKey = yield* gitHubAppKeyFixture("pkcs8");
        const installationChecks = yield* Ref.make(0);
        const gitHubApi = setupServer(
          http.get(repositoryApi, () =>
            HttpResponse.json({ id: 77, owner: { id: 9, type: "User" } }),
          ),
          http.get(`${repositoryApi}/installation`, ({ request: incoming }) =>
            Effect.runPromiseWith(services)(
              Effect.gen(function* answerInstallation() {
                const signed = yield* Effect.promise(() =>
                  appKey.signedBy(incoming.headers.get("authorization"), String(appId)),
                );
                const checks = yield* Ref.updateAndGet(
                  installationChecks,
                  (checkCount) => checkCount + 1,
                );
                if (!signed) {
                  return HttpResponse.json({}, { status: httpStatus.unauthorized });
                }
                return checks > scenario.installedAfter
                  ? HttpResponse.json({ id: installationId })
                  : HttpResponse.json({}, { status: httpStatus.notFound });
              }),
            ),
          ),
        );
        gitHubApi.listen({ onUnhandledRequest: "error" });
        onCleanup(() => {
          gitHubApi.close();
        });
        const announcements = yield* Ref.make<readonly string[]>([]);
        const privateKeys = {
          broken: "not a key",
          foreign: foreignKey.privateKey,
          issued: appKey.privateKey,
        };
        const ensured = yield* Effect.result(
          ensureInstallation({
            address: definition,
            app: { appId, privateKey: Redacted.make(privateKeys[scenario.signingKey]) },
            slug,
            token: Redacted.make(operatorToken),
            wait: {
              announce: (line) => Ref.update(announcements, (announced) => [...announced, line]),
              pollInterval: "10 millis",
              timeout: "10 seconds",
            },
          }),
        );
        return {
          announcements: yield* Ref.get(announcements),
          failure: Result.isFailure(ensured)
            ? {
                caused: ensured.failure.cause !== undefined,
                code: ensured.failure.code,
                status: ensured.failure.status,
                step: ensured.failure.step,
              }
            : undefined,
          installed: Result.getOrUndefined(ensured),
        };
      }).pipe(Effect.runPromise));

    it("reports the installation and what the operator was asked", ({ installationReport }) => {
      expect(installationReport).toStrictEqual(promisedReport);
    });
  });
});

describe("uninstall", () => {
  describe.for([
    [httpStatus.noContent, true],
    [httpStatus.notFound, true],
    [httpStatus.internalServerError, false],
  ] as const)("GitHub answering %i", ([uninstallStatus, removedPromised]) => {
    const it = test.extend("uninstallReport", ({}, { onCleanup }) =>
      Effect.gen(function* uninstallReport() {
        const appKey = yield* gitHubAppKeyFixture("pkcs1");
        const services = yield* Effect.context();
        const removals = yield* Ref.make<readonly string[]>([]);
        const gitHubApi = setupServer(
          http.all(
            `${gitHubApiOrigin}/app/installations/:installation`,
            ({ params, request: incoming }) =>
              Effect.runPromiseWith(services)(
                Effect.gen(function* answerRemoval() {
                  const signed = yield* Effect.promise(() =>
                    appKey.signedBy(incoming.headers.get("authorization"), String(appId)),
                  );
                  yield* Ref.update(removals, (removed) => [
                    ...removed,
                    String(params.installation),
                  ]);
                  return signed
                    ? new HttpResponse(null, { status: uninstallStatus })
                    : HttpResponse.json({}, { status: httpStatus.unauthorized });
                }),
              ),
          ),
        );
        gitHubApi.listen({ onUnhandledRequest: "error" });
        onCleanup(() => {
          gitHubApi.close();
        });
        const removal = yield* Effect.result(
          uninstall({ appId, privateKey: Redacted.make(appKey.privateKey) }, installationId),
        );
        return { removed: Result.isSuccess(removal), requested: yield* Ref.get(removals) };
      }).pipe(Effect.runPromise));

    it("asks GitHub to remove the installation once", ({ uninstallReport }) => {
      expect(uninstallReport).toStrictEqual({
        removed: removedPromised,
        requested: [String(installationId)],
      });
    });
  });
});

describe("replacesApp", () => {
  describe.for([
    ["the same definition", definition, false],
    [
      "permissions listed in another order",
      { ...definition, permissions: { pull_requests: "write", contents: "write" } },
      false,
    ],
    ["another owner", { ...definition, owner: "other" }, true],
    ["another name", { ...definition, name: "renamed" }, true],
    ["another homepage", { ...definition, url: "https://widgets.test" }, true],
    ["other permissions", { ...definition, permissions: { contents: "read" } }, true],
  ] as const)("%s", ([, changedDefinition, replacementPromised]) => {
    const it = test.extend("replacement", () => replacesApp(definition, changedDefinition));

    it("decides whether GitHub needs a new App", ({ replacement }) => {
      expect(replacement).toBe(replacementPromised);
    });
  });
});
