import { applications, loopbackAddress, loopbackOrigin } from "@repo/config";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { createServer } from "vite-plus";
import { describe, expect, test as baseTest } from "vite-plus/test";

const encodeJson = (value: unknown): string =>
  Effect.runSync(
    Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(value).pipe(Effect.orDie),
  );

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

const fetchResponse = (url: string): Effect.Effect<Response, never> =>
  HttpClient.get(url).pipe(
    Effect.flatMap((response) =>
      response.text.pipe(
        Effect.map(
          (text) =>
            new Response(text, {
              headers: response.headers,
              status: response.status,
            }),
        ),
      ),
    ),
    Effect.provide(httpLayer),
    Effect.orDie,
  );

describe.each(applications)("the %s development server", (application) => {
  const foreignApplications = applicationsExcept(application);
  const applicationEntrySource = `export const label = "${application}-module";`;
  const servedApplicationEntryModule = `export default ${encodeJson(applicationEntrySource)}`;
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
        ? `${okStatus} export default ${encodeJson(administratorDatabaseSource)};\n`
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
    .extend("repositoryRoot", ({}, { onCleanup }) =>
      Effect.runPromise(
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
      ).then(({ repositoryRoot, temporaryDirectory }) => {
        onCleanup(() =>
          Effect.runPromise(
            filesystem.remove(temporaryDirectory, { force: true, recursive: true }),
          ),
        );
        return repositoryRoot;
      }),
    )
    .extend("devServerOrigin", ({ repositoryRoot }, { onCleanup }) =>
      Effect.runPromise(
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
      ).then(({ devServer, origin }) => {
        onCleanup(() => Effect.runPromise(Effect.promise(() => devServer.close())));
        return origin;
      }),
    )
    .extend("statusesOfTheOwnApplicationEntryPoints", ({ devServerOrigin }) =>
      Effect.runPromise(
        Effect.forEach(
          ownApplicationEntryPoints,
          (entryPoint) =>
            fetchResponse(new URL(entryPoint, devServerOrigin).href).pipe(
              Effect.map((served) => [entryPoint, served.status] as const),
            ),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((entries) => Object.fromEntries(entries))),
      ),
    )
    .extend("textOfTheApplicationEntryModule", ({ devServerOrigin }) =>
      Effect.runPromise(
        fetchResponse(new URL("/src/entry.js?raw", devServerOrigin).href).pipe(
          Effect.flatMap((served) => Effect.promise(() => served.text())),
        ),
      ),
    )
    .extend("responsesOfTheGuardedFiles", ({ devServerOrigin, repositoryRoot }) =>
      Effect.runPromise(
        Effect.forEach(
          guardedFilePaths,
          (guardedFile) =>
            fetchResponse(
              new URL(`/@fs/${repositoryRoot}/${guardedFile}`, devServerOrigin).href,
            ).pipe(
              Effect.flatMap((served) =>
                Effect.promise(() => served.text()).pipe(
                  Effect.map((text) => [guardedFile, `${served.status} ${text}`] as const),
                ),
              ),
            ),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((entries) => Object.fromEntries(entries))),
      ),
    )
    .extend("responsesOfTheUndecidableRequests", ({ devServerOrigin }) =>
      Effect.runPromise(
        Effect.forEach(
          undecidablePaths,
          (undecidablePath) =>
            fetchResponse(new URL(undecidablePath, devServerOrigin).href).pipe(
              Effect.flatMap((served) =>
                Effect.promise(() => served.text()).pipe(
                  Effect.map((text) => [undecidablePath, `${served.status} ${text}`] as const),
                ),
              ),
            ),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((entries) => Object.fromEntries(entries))),
      ),
    )
    .extend("statusesOfThePrivateModules", ({ devServerOrigin, repositoryRoot }) =>
      Effect.runPromise(
        Effect.forEach(
          privateModulePaths,
          (privateModule) =>
            fetchResponse(
              new URL(privateModule.replace("{repository}", repositoryRoot), devServerOrigin).href,
            ).pipe(Effect.map((served) => [privateModule, served.status] as const)),
          { concurrency: "unbounded" },
        ).pipe(Effect.map((entries) => Object.fromEntries(entries))),
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
