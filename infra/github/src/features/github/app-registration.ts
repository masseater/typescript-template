import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { httpStatus } from "@repo/config";
import {
  Context,
  Crypto,
  Deferred,
  type Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
  type Scope,
} from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { escape } from "es-toolkit";

import {
  type InstallationWait,
  awaitInstallation,
  installationUrl,
  ownedRepository,
} from "./app-installation.ts";
import { GitHubAppFailure, gitHubRequest } from "./github-api.ts";

import type { NetAddress } from "effect/unstable/net";
import type { RepositoryAddress } from "./repository.ts";

type AppDefinition = RepositoryAddress &
  Readonly<{ name: string; permissions: Readonly<Record<string, string>>; url: string }>;

type RegisteredApp = Readonly<{
  appId: number;
  htmlUrl: string;
  installationId: number | undefined;
  privateKey: Redacted.Redacted;
  slug: string;
}>;

type Registration = Readonly<{
  manifestTimeout: Duration.Input;
  token: Redacted.Redacted;
  wait: InstallationWait;
}>;

type ManifestHandoff = Readonly<{
  code: Deferred.Deferred<string>;
  installation: Deferred.Deferred<string, GitHubAppFailure>;
  origin: string;
}>;

const createdPath = "/created";
const notInstalledNotice = "The GitHub App is not installed yet; install it and deploy again";

const Conversion = Schema.Struct({
  html_url: Schema.String,
  id: Schema.Finite,
  pem: Schema.String,
  slug: Schema.String,
});

const permissionsText = (definition: AppDefinition): string =>
  JSON.stringify(
    Object.entries(definition.permissions).toSorted(([left], [right]) => left.localeCompare(right)),
  );

const replacesApp = (olds: AppDefinition, news: AppDefinition): boolean =>
  news.owner !== olds.owner ||
  news.name !== olds.name ||
  news.url !== olds.url ||
  permissionsText(news) !== permissionsText(olds);

const manifestPage = (
  definition: AppDefinition,
  formPlacement: Readonly<{ manifestState: string; organization: boolean; origin: string }>,
): string => {
  const newAppPath = formPlacement.organization
    ? `/organizations/${definition.owner}/settings/apps/new`
    : "/settings/apps/new";
  const manifest = {
    default_events: [],
    default_permissions: definition.permissions,
    hook_attributes: { active: false, url: definition.url },
    name: definition.name,
    public: false,
    redirect_url: `${formPlacement.origin}${createdPath}`,
    url: definition.url,
  };
  return `<!doctype html><form id="manifest" method="post" action="https://github.com${newAppPath}?state=${formPlacement.manifestState}"><input type="hidden" name="manifest" value="${escape(
    JSON.stringify(manifest),
  )}"><button>Create GitHub App</button></form><script>document.getElementById("manifest").submit()</script>`;
};

const answerBrowser = (
  handoff: ManifestHandoff,
  page: Readonly<{ markup: string; manifestState: string }>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* answerBrowser() {
    const browserRequest = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(browserRequest.url, handoff.origin);
    if (url.pathname === "/") {
      return HttpServerResponse.text(page.markup, { contentType: "text/html; charset=utf-8" });
    }
    const returned = yield* Schema.decodeUnknownEffect(
      Schema.Struct({ code: Schema.NonEmptyString, state: Schema.Literal(page.manifestState) }),
    )(Object.fromEntries(url.searchParams)).pipe(Effect.option);
    if (url.pathname !== createdPath || Option.isNone(returned)) {
      return HttpServerResponse.empty({ status: httpStatus.badRequest });
    }
    yield* Deferred.succeed(handoff.code, returned.value.code);
    return yield* Deferred.await(handoff.installation).pipe(
      Effect.map((location) => HttpServerResponse.redirect(location, { status: httpStatus.found })),
      Effect.orElseSucceed(() =>
        HttpServerResponse.empty({ status: httpStatus.serviceUnavailable }),
      ),
    );
  });

const openManifestPage = Effect.fn("openGitHubAppManifestPage")(function* openManifestPage(
  definition: AppDefinition,
  organization: boolean,
) {
  const built = yield* Layer.build(NodeHttpServer.layerTest).pipe(Effect.orDie);
  const server = Context.get(built, HttpServer.HttpServer);
  const address = yield* Effect.succeed(server.address).pipe(
    Effect.filterOrFail(
      (bound): bound is NetAddress.InetAddressV4 | NetAddress.InetAddressV6 =>
        bound._tag !== "UnixPathAddress",
      () => new GitHubAppFailure({ code: "github_unreachable", step: "local-server" }),
    ),
  );
  const manifestState = yield* (yield* Crypto.Crypto).randomUUIDv4.pipe(Effect.orDie);
  const handoff: ManifestHandoff = {
    code: yield* Deferred.make<string>(),
    installation: yield* Deferred.make<string, GitHubAppFailure>(),
    origin: `http://127.0.0.1:${String(address.port)}`,
  };
  const markup = manifestPage(definition, { manifestState, organization, origin: handoff.origin });
  yield* server.serve(answerBrowser(handoff, { manifestState, markup }));
  return handoff;
});

const awaitCreatedApp = Effect.fn("awaitCreatedGitHubApp")(function* awaitCreatedApp(
  handoff: ManifestHandoff,
  registration: Registration &
    Readonly<{ definition: AppDefinition; repository: Parameters<typeof installationUrl>[1] }>,
) {
  const code = yield* Deferred.await(handoff.code).pipe(
    Effect.timeoutOrElse({
      duration: registration.manifestTimeout,
      orElse: () =>
        Effect.fail(new GitHubAppFailure({ code: "manifest_timeout", step: "manifest" })),
    }),
  );
  const createdApp = yield* gitHubRequest(Conversion, {
    method: "POST",
    path: `/app-manifests/${code}/conversions`,
    step: "conversion",
  }).pipe(Effect.tapError((failure) => Deferred.fail(handoff.installation, failure)));
  const location = installationUrl(createdApp.slug, registration.repository);
  yield* Deferred.succeed(handoff.installation, location);
  yield* registration.wait.announce(
    `Install the GitHub App on ${registration.definition.owner}/${registration.definition.repository}: ${location}`,
  );
  return createdApp;
});

const registerApp = Effect.fn("registerGitHubApp")(
  function* registerApp(definition: AppDefinition, registration: Registration) {
    const repository = yield* ownedRepository(definition, registration.token);
    const handoff = yield* openManifestPage(definition, repository.owner.type === "Organization");
    yield* registration.wait.announce(`Open ${handoff.origin}/ to create the GitHub App`);
    const createdApp = yield* awaitCreatedApp(handoff, {
      ...registration,
      definition,
      repository,
    });
    const appKey = { appId: createdApp.id, privateKey: Redacted.make(createdApp.pem) };
    const installationId = yield* awaitInstallation({
      address: definition,
      app: appKey,
      wait: registration.wait,
    }).pipe(
      Effect.catchIf(
        (failure) => failure.code === "installation_timeout",
        () => registration.wait.announce(notInstalledNotice).pipe(Effect.as(undefined)),
      ),
    );
    return {
      ...appKey,
      htmlUrl: createdApp.html_url,
      installationId,
      slug: createdApp.slug,
    } satisfies RegisteredApp;
  },
  (registering: Effect.Effect<RegisteredApp, GitHubAppFailure, Scope.Scope | Crypto.Crypto>) =>
    registering.pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

export { registerApp, replacesApp };
export type { AppDefinition, RegisteredApp };
