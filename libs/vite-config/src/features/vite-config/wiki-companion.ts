import { createServer as createNetServer } from "node:net";

import { NodeServices } from "@effect/platform-node";
import {
  loopbackAddress,
  loopbackOrigin,
  waitUntilResponds,
  wikiApiBinding,
  wikiApiEntrypoint,
  wikiBasePath,
  wikiPagesBinding,
  wikiWorker,
} from "@repo/config";
import { Effect, Exit, Scope } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { paths } from "./host.ts";

import type { ConfigEnv, Plugin, UserConfig } from "vite-plus";

const wikiHmrPath = "__hmr";
const devModulePattern = `^${wikiBasePath}/(?:@|src/|node_modules/|${wikiHmrPath})`;
const attemptTimeoutMilliseconds = 5000;
const readyAttempts = 240;
const readyStatus = 200;

const wikiDevWorkerName = `template-${wikiWorker}`;

const wikiDevServices = [
  { binding: wikiPagesBinding, service: wikiDevWorkerName },
  { binding: wikiApiBinding, entrypoint: wikiApiEntrypoint, service: wikiDevWorkerName },
];

const probedPort = (
  probe: Readonly<Pick<ReturnType<typeof createNetServer>, "address">>,
): Effect.Effect<number> => {
  const address = probe.address();
  return typeof address === "object" && address !== null
    ? Effect.succeed(address.port)
    : Effect.die("WIKI_DEV_PORT_UNAVAILABLE");
};

const freePort: Effect.Effect<number> = Effect.callback<number>((resume) => {
  const probe = createNetServer();
  const release = (): void => {
    const port = probedPort(probe);
    probe.close(() => {
      resume(port);
    });
  };
  probe.listen(0, loopbackAddress, release);
});

type WikiRoots = Readonly<{ repositoryRoot: string; wikiRoot: string }>;

const startWiki = (roots: WikiRoots): Effect.Effect<string, never, Scope.Scope> =>
  Effect.gen(function* startWikiProgram() {
    const port = yield* freePort;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    yield* spawner
      .spawn(
        ChildProcess.make(
          paths.join(roots.repositoryRoot, "node_modules/.bin/vp"),
          ["dev", "--host", loopbackAddress, "--port", String(port), "--strictPort"],
          {
            cwd: roots.wikiRoot,
            extendEnv: true,
            stderr: "inherit",
            stdin: "ignore",
            stdout: "inherit",
          },
        ),
      )
      .pipe(Effect.orDie);
    const wikiOrigin = loopbackOrigin(port);
    yield* waitUntilResponds({
      accept: (responded) => responded === readyStatus,
      method: "GET",
      onStatus: (responded) => `WIKI_DEV_SERVER_RESPONDED_${responded}`,
      onUnreachable: () => "WIKI_DEV_SERVER_UNREACHABLE",
      retry: { interval: "500 millis", times: readyAttempts },
      timeoutMilliseconds: attemptTimeoutMilliseconds,
      url: `${wikiOrigin}${wikiBasePath}/@vite/client`,
    }).pipe(Effect.orDie);
    return wikiOrigin;
  }).pipe(Effect.provide(NodeServices.layer));

const wikiCompanion = (roots: WikiRoots): Plugin => {
  const scope = Scope.makeUnsafe();
  const stop = (): void => {
    Effect.runFork(Scope.close(scope, Exit.void));
  };
  return {
    apply: (_config: unknown, environment: Readonly<ConfigEnv>) =>
      environment.command === "serve" && environment.isPreview !== true,
    config: (): Promise<UserConfig> =>
      Effect.runPromise(
        startWiki(roots).pipe(
          Scope.provide(scope),
          Effect.map((wikiOrigin): UserConfig => ({
            server: {
              proxy: {
                [devModulePattern]: { changeOrigin: true, target: wikiOrigin, ws: true },
              },
            },
          })),
        ),
      ),
    configureServer(
      server: Readonly<{
        httpServer: Readonly<{ once: (event: "close", listener: () => void) => unknown }> | null;
      }>,
    ) {
      server.httpServer?.once("close", stop);
      process.once("exit", stop);
    },
    name: "template-wiki-companion",
  };
};

export { wikiCompanion, wikiDevServices, wikiDevWorkerName, wikiHmrPath };
export type { WikiRoots };
