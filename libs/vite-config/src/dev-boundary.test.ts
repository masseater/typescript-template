import { applications, loopbackAddress, loopbackOrigin } from "@repo/config";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { createServer } from "vite-plus";
import { describe, expect, test as baseTest } from "vite-plus/test";

import { devBoundary } from "./dev-boundary.ts";
import { filesystem, paths } from "./host.ts";
import { applicationsExcept } from "./private-path.ts";

const okStatus = 200;
const forbiddenStatus = 403;
const badRequestStatus = 400;
const hexRadix = 16;
const refusalText = "Private development resource denied";
const administratorDatabaseModulePath = "libs/db/src/admin.ts?raw";
const administratorDatabaseSource = 'export const label = "private-admin-database";';
const httpLayer = FetchHttpClient.layer;

describe.each(applications)("the %s development server", (application) => {
  const foreignApplications = applicationsExcept(application);
  const applicationEntrySource = `export const label = "${application}-module";`;
  const servedApplicationEntryModule = `export default ${Effect.runSync(
    Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(applicationEntrySource).pipe(
      Effect.orDie,
    ),
  )}`;
  const ownApplicationEntryPoints = ["/", "/@vite/client", "/src/entry.js"];
  const servedOwnApplicationEntryPoints = Object.fromEntries(
    ownApplicationEntryPoints.map((entryPoint) => [entryPoint, okStatus]),
  );
  const guardedFilePaths = [
    ...[
      ".local/runtime.json",
      `apps/${application}/.dev.vars`,
      "libs/db/src/remote-cli.ts",
      "tools/private.js",
      ...foreignApplications.map((foreign) => `apps/${foreign}/src/private.js`),
    ].flatMap((privateFile) => ["", "?raw", "?import"].map((suffix) => `${privateFile}${suffix}`)),
    administratorDatabaseModulePath,
  ];
  const servedGuardedFiles = Object.fromEntries(
    guardedFilePaths.map((guardedFile) => [
      guardedFile,
      guardedFile === administratorDatabaseModulePath && application === "service-admin"
        ? `${okStatus} export default ${Effect.runSync(
            Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
              administratorDatabaseSource,
            ).pipe(Effect.orDie),
          )};\n`
        : `${forbiddenStatus} ${refusalText}`,
    ]),
  );
  const privateModulePaths = [
    "/.dev.vars",
    "/src/alias.json",
    "/@id/@repo/db/remote",
    ...(application === "service-admin" ? [] : ["/@id/@repo/db/admin"]),
    ...foreignApplications.flatMap((foreign) => [
      `/@id/@repo/${foreign}`,
      `/@fs/{repository}/apps/%${(foreign.codePointAt(0) ?? 0).toString(hexRadix)}${foreign.slice(1)}/src/private.js?raw`,
    ]),
  ];
  const refusedPrivateModules = Object.fromEntries(
    privateModulePaths.map((privateModule) => [privateModule, forbiddenStatus]),
  );
  const undecidablePaths = ["/%", "/src/%E0%A4%A"];
  const refusedUndecidableRequests = Object.fromEntries(
    undecidablePaths.map((undecidablePath) => [
      undecidablePath,
      `${badRequestStatus} Invalid request`,
    ]),
  );

  const it = baseTest
    .extend("repositoryRoot", ({}, { onCleanup }) => {
      const built = Effect.runPromise(
        Effect.gen(function* repositoryRootProgram() {
          const temporaryDirectory = yield* filesystem.makeTempDirectory({
            prefix: `${application}-dev-boundary-`,
          });
          const repositoryRoot = yield* filesystem.realPath(temporaryDirectory);
          const applicationRoot = paths.join(repositoryRoot, "apps", application);
          yield* Effect.forEach(
            [
              ...applications.map((candidate) => `apps/${candidate}/src`),
              "libs/db/src",
              "libs/ui",
              ".local",
              "tools",
            ],
            (folder) =>
              filesystem.makeDirectory(paths.join(repositoryRoot, folder), { recursive: true }),
            { concurrency: "unbounded" },
          );
          yield* Effect.all(
            [
              filesystem.writeFileString(
                paths.join(applicationRoot, "index.html"),
                '<html><body>App<script type="module" src="/src/entry.js"></script></body></html>',
              ),
              filesystem.writeFileString(
                paths.join(applicationRoot, "src/entry.js"),
                applicationEntrySource,
              ),
              ...foreignApplications.map((foreign) =>
                filesystem.writeFileString(
                  paths.join(repositoryRoot, `apps/${foreign}/src/private.js`),
                  'export const label = "private-application-module";',
                ),
              ),
              filesystem.writeFileString(
                paths.join(repositoryRoot, "libs/db/src/remote-cli.ts"),
                'export const label = "private-remote-database";',
              ),
              filesystem.writeFileString(
                paths.join(repositoryRoot, "libs/db/src/admin.ts"),
                administratorDatabaseSource,
              ),
              filesystem.writeFileString(
                paths.join(repositoryRoot, ".local/runtime.json"),
                '{"password":"test-secret-marker"}',
              ),
              filesystem.writeFileString(
                paths.join(applicationRoot, ".dev.vars"),
                'AUTH_SECRET="test-secret-marker-dev-vars"',
              ),
              filesystem.writeFileString(
                paths.join(repositoryRoot, "tools/private.js"),
                'export const label = "private-internal-module";',
              ),
              filesystem.symlink(
                paths.join(repositoryRoot, ".local/runtime.json"),
                paths.join(applicationRoot, "src/alias.json"),
              ),
            ],
            { concurrency: "unbounded" },
          );
          return { repositoryRoot, temporaryDirectory };
        }),
      );
      onCleanup(() =>
        Effect.runPromise(
          Effect.promise(() => built).pipe(
            Effect.flatMap(({ temporaryDirectory }) =>
              filesystem.remove(temporaryDirectory, { force: true, recursive: true }),
            ),
          ),
        ),
      );
      return Effect.runPromise(
        Effect.promise(() => built).pipe(Effect.map(({ repositoryRoot }) => repositoryRoot)),
      );
    })
    .extend("devServerOrigin", ({ repositoryRoot }, { onCleanup }) => {
      const started = Effect.runPromise(
        Effect.gen(function* startDevServer() {
          const devServer = yield* Effect.promise(() =>
            createServer({
              configFile: false,
              logLevel: "silent",
              plugins: [devBoundary(application, repositoryRoot)],
              root: paths.join(repositoryRoot, "apps", application),
              server: { host: loopbackAddress, port: 0, strictPort: true },
            }),
          );
          yield* Effect.promise(() => devServer.listen());
          const listeningAddress = devServer.httpServer?.address();
          if (listeningAddress === undefined || listeningAddress === null) {
            return yield* Effect.die("TEST_SERVER_ADDRESS_REQUIRED");
          }
          if (typeof listeningAddress === "string") {
            return yield* Effect.die("TEST_SERVER_ADDRESS_REQUIRED");
          }
          return { devServer, origin: loopbackOrigin(listeningAddress.port) };
        }),
      );
      onCleanup(() =>
        Effect.runPromise(
          Effect.promise(() => started).pipe(
            Effect.flatMap(({ devServer }) => Effect.promise(() => devServer.close())),
          ),
        ),
      );
      return Effect.runPromise(
        Effect.promise(() => started).pipe(Effect.map(({ origin }) => origin)),
      );
    })
    .extend("statusesOfTheOwnApplicationEntryPoints", ({ devServerOrigin }) =>
      Effect.runPromise(
        Effect.forEach(
          ownApplicationEntryPoints,
          (entryPoint) =>
            Effect.gen(function* ownApplicationEntryPoint() {
              const servedPage = yield* HttpClient.get(new URL(entryPoint, devServerOrigin).href);
              return [entryPoint, servedPage.status] as const;
            }).pipe(Effect.provide(httpLayer), Effect.orDie),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((statusPairs) => Object.fromEntries(statusPairs))),
      ),
    )
    .extend("textOfTheApplicationEntryModule", ({ devServerOrigin }) =>
      Effect.runPromise(
        Effect.gen(function* applicationEntryModuleText() {
          const servedPage = yield* HttpClient.get(
            new URL("/src/entry.js?raw", devServerOrigin).href,
          );
          return yield* servedPage.text;
        }).pipe(Effect.provide(httpLayer), Effect.orDie),
      ),
    )
    .extend("responsesOfTheGuardedFiles", ({ devServerOrigin, repositoryRoot }) =>
      Effect.runPromise(
        Effect.forEach(
          guardedFilePaths,
          (guardedFile) =>
            Effect.gen(function* guardedFilePage() {
              const servedPage = yield* HttpClient.get(
                new URL(`/@fs/${repositoryRoot}/${guardedFile}`, devServerOrigin).href,
              );
              const pageBody = yield* servedPage.text;
              return [guardedFile, `${servedPage.status} ${pageBody}`] as const;
            }).pipe(Effect.provide(httpLayer), Effect.orDie),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((responsePairs) => Object.fromEntries(responsePairs))),
      ),
    )
    .extend("responsesOfTheUndecidableRequests", ({ devServerOrigin }) =>
      Effect.runPromise(
        Effect.forEach(
          undecidablePaths,
          (undecidablePath) =>
            Effect.gen(function* undecidablePage() {
              const servedPage = yield* HttpClient.get(
                new URL(undecidablePath, devServerOrigin).href,
              );
              const pageBody = yield* servedPage.text;
              return [undecidablePath, `${servedPage.status} ${pageBody}`] as const;
            }).pipe(Effect.provide(httpLayer), Effect.orDie),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((responsePairs) => Object.fromEntries(responsePairs))),
      ),
    )
    .extend("statusesOfThePrivateModules", ({ devServerOrigin, repositoryRoot }) =>
      Effect.runPromise(
        Effect.forEach(
          privateModulePaths,
          (privateModule) =>
            Effect.gen(function* privateModulePage() {
              const servedPage = yield* HttpClient.get(
                new URL(privateModule.replace("{repository}", repositoryRoot), devServerOrigin)
                  .href,
              );
              return [privateModule, servedPage.status] as const;
            }).pipe(Effect.provide(httpLayer), Effect.orDie),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((statusPairs) => Object.fromEntries(statusPairs))),
      ),
    );

  it("serves the entry points of the application it belongs to", ({
    statusesOfTheOwnApplicationEntryPoints,
  }) => {
    expect(statusesOfTheOwnApplicationEntryPoints).toStrictEqual(servedOwnApplicationEntryPoints);
  });

  it("serves the source module of the application it belongs to", ({
    textOfTheApplicationEntryModule,
  }) => {
    expect(textOfTheApplicationEntryModule).toBe(servedApplicationEntryModule);
  });

  it("hands back of every guarded file only what this application may read", ({
    responsesOfTheGuardedFiles,
  }) => {
    expect(responsesOfTheGuardedFiles).toStrictEqual(servedGuardedFiles);
  });

  it("refuses every private module", ({ statusesOfThePrivateModules }) => {
    expect(statusesOfThePrivateModules).toStrictEqual(refusedPrivateModules);
  });

  it("refuses a request whose path it cannot decode", ({ responsesOfTheUndecidableRequests }) => {
    expect(responsesOfTheUndecidableRequests).toStrictEqual(refusedUndecidableRequests);
  });
});
