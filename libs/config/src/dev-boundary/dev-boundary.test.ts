import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createServer } from "vite-plus";
import { describe, expect, test as baseTest } from "vite-plus/test";

import { applications, loopbackAddress, loopbackOrigin } from "../applications.ts";
import { devBoundary } from "./dev-boundary.ts";
import { applicationsExcept } from "./private-path.ts";

const okStatus = 200;
const forbiddenStatus = 403;
const badRequestStatus = 400;
const hexRadix = 16;
const refusalText = "Private development resource denied";
const administratorDatabaseModulePath = "libs/db/src/admin.ts?raw";
const administratorDatabaseSource = 'export const label = "private-admin-database";';

describe.each(applications)("the %s development server", (application) => {
  const foreignApplications = applicationsExcept(application);
  const applicationEntrySource = `export const label = "${application}-module";`;
  const servedApplicationEntryModule = `export default ${JSON.stringify(applicationEntrySource)}`;
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
        ? `${okStatus} export default ${JSON.stringify(administratorDatabaseSource)};\n`
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
    .extend("repositoryRoot", async ({}, { onCleanup }) => {
      const temporaryDirectory = await mkdtemp(path.join(tmpdir(), `${application}-dev-boundary-`));
      onCleanup(async () => {
        await rm(temporaryDirectory, { force: true, recursive: true });
      });
      const repositoryRoot = await realpath(temporaryDirectory);
      const applicationRoot = path.join(repositoryRoot, "apps", application);
      await Promise.all(
        [
          ...applications.map((candidate) => `apps/${candidate}/src`),
          "libs/db/src",
          "libs/ui",
          ".local",
          "tools",
        ].map(async (folder) => {
          await mkdir(path.join(repositoryRoot, folder), { recursive: true });
        }),
      );
      await Promise.all([
        writeFile(
          path.join(applicationRoot, "index.html"),
          '<html><body>App<script type="module" src="/src/entry.js"></script></body></html>',
        ),
        writeFile(path.join(applicationRoot, "src/entry.js"), applicationEntrySource),
        ...foreignApplications.map(async (foreign) =>
          writeFile(
            path.join(repositoryRoot, `apps/${foreign}/src/private.js`),
            'export const label = "private-application-module";',
          ),
        ),
        writeFile(
          path.join(repositoryRoot, "libs/db/src/remote-cli.ts"),
          'export const label = "private-remote-database";',
        ),
        writeFile(path.join(repositoryRoot, "libs/db/src/admin.ts"), administratorDatabaseSource),
        writeFile(
          path.join(repositoryRoot, ".local/runtime.json"),
          '{"password":"test-secret-marker"}',
        ),
        writeFile(
          path.join(applicationRoot, ".dev.vars"),
          'AUTH_SECRET="test-secret-marker-dev-vars"',
        ),
        writeFile(
          path.join(repositoryRoot, "tools/private.js"),
          'export const label = "private-internal-module";',
        ),
        symlink(
          path.join(repositoryRoot, ".local/runtime.json"),
          path.join(applicationRoot, "src/alias.json"),
        ),
      ]);
      return repositoryRoot;
    })
    .extend("devServerOrigin", async ({ repositoryRoot }, { onCleanup }) => {
      const devServer = await createServer({
        configFile: false,
        logLevel: "silent",
        plugins: [devBoundary(application, repositoryRoot)],
        root: path.join(repositoryRoot, "apps", application),
        server: { host: loopbackAddress, port: 0, strictPort: true },
      });
      onCleanup(async () => {
        await devServer.close();
      });
      await devServer.listen();
      const listeningAddress = devServer.httpServer?.address();
      if (listeningAddress === undefined || listeningAddress === null) {
        throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
      }
      if (typeof listeningAddress === "string") {
        throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
      }
      return loopbackOrigin(listeningAddress.port);
    })
    .extend("statusesOfTheOwnApplicationEntryPoints", async ({ devServerOrigin }) =>
      Object.fromEntries(
        await Promise.all(
          ownApplicationEntryPoints.map(async (entryPoint): Promise<readonly [string, number]> => {
            const served = await fetch(new URL(entryPoint, devServerOrigin));
            return [entryPoint, served.status];
          }),
        ),
      ),
    )
    .extend("textOfTheApplicationEntryModule", async ({ devServerOrigin }) => {
      const served = await fetch(new URL("/src/entry.js?raw", devServerOrigin));
      return served.text();
    })
    .extend("responsesOfTheGuardedFiles", async ({ devServerOrigin, repositoryRoot }) =>
      Object.fromEntries(
        await Promise.all(
          guardedFilePaths.map(async (guardedFile): Promise<readonly [string, string]> => {
            const served = await fetch(
              new URL(`/@fs/${repositoryRoot}/${guardedFile}`, devServerOrigin),
            );
            return [guardedFile, `${served.status} ${await served.text()}`];
          }),
        ),
      ),
    )
    .extend("responsesOfTheUndecidableRequests", async ({ devServerOrigin }) =>
      Object.fromEntries(
        await Promise.all(
          undecidablePaths.map(async (undecidablePath): Promise<readonly [string, string]> => {
            const served = await fetch(new URL(undecidablePath, devServerOrigin));
            return [undecidablePath, `${served.status} ${await served.text()}`];
          }),
        ),
      ),
    )
    .extend("statusesOfThePrivateModules", async ({ devServerOrigin, repositoryRoot }) =>
      Object.fromEntries(
        await Promise.all(
          privateModulePaths.map(async (privateModule): Promise<readonly [string, number]> => {
            const served = await fetch(
              new URL(privateModule.replace("{repository}", repositoryRoot), devServerOrigin),
            );
            return [privateModule, served.status];
          }),
        ),
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
