import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import type { Server } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Cause, Effect } from "effect";
import { makeBrowser } from "./browser.ts";
import type { Browser } from "./browser.ts";
import { findMessages } from "./mail.ts";
import {
  ensure,
  fail,
  json,
  mailpit,
  object,
  poll,
  fetchResponse,
  root,
  run,
  shellQuote,
  string,
} from "./support.ts";

const prerequisites = Effect.fn("prerequisites")(function* () {
  const checks = [["Mailpit:8025", json(`${mailpit}/api/v1/info`)]] as const;
  const results = yield* Effect.forEach(checks, ([, check]) => Effect.exit(check), {
    concurrency: "unbounded",
  });
  const missing = checks
    .filter((_, index) => results[index]?._tag === "Failure")
    .map(([name]) => name);
  yield* ensure(
    missing.length === 0,
    `E2E_DEPENDENCIES_UNAVAILABLE: ${missing.join(", ")}. Start the real local services; E2E cannot be skipped or mocked.`,
  );
  yield* ensure(
    (yield* run("agent-browser", ["--version"])).trim() === "agent-browser 0.37.1",
    "E2E_REQUIRES_AGENT_BROWSER_0.37.1",
  );
  yield* run("tmux", ["-V"]);
});

const closeServer = (server: Server) =>
  Effect.callback<void, Cause.UnknownError>((resume) => {
    if (!server.listening) return resume(Effect.void);
    server.close((error) =>
      resume(error ? Effect.fail(new Cause.UnknownError(error)) : Effect.void),
    );
  });

const reservePort = Effect.fn("reservePort")(function* () {
  const server = createServer();
  yield* Effect.callback<void, Cause.UnknownError>((resume) => {
    server.once("error", (error) => resume(Effect.fail(new Cause.UnknownError(error))));
    server.listen(0, "127.0.0.1", () => resume(Effect.void));
  });
  const address = server.address();
  if (!address || typeof address !== "object") return yield* fail("E2E_PORT_ALLOCATION_FAILED");
  return { port: address.port, close: closeServer(server) };
});

type Reservation = Effect.Success<ReturnType<typeof reservePort>>;

const attempt = <A, E, R>(effect: Effect.Effect<A, E, R>, label: string, errors: string[]) =>
  effect.pipe(
    Effect.asVoid,
    Effect.catchCause(() => Effect.sync(() => errors.push(label))),
  );

export const createStack = Effect.fn("createStack")(function* () {
  yield* prerequisites();
  const local = path.join(root, ".local");
  const sessions = new Set<string>();
  const browsers = new Set<Browser>();
  const messages = new Set<string>();
  const registrations = new Set<string>();
  const ports: Reservation[] = [];

  const cleanup = Effect.fn("cleanup")(function* (directory: string) {
    const errors: string[] = [];
    for (const browser of browsers) yield* attempt(browser.close(), "browser", errors);
    for (const session of sessions)
      yield* attempt(run("tmux", ["kill-session", "-t", session]), "worker-exited", errors);
    yield* Effect.tryPromise(() =>
      mkdir(path.join(local, "logs"), { recursive: true, mode: 0o700 }),
    );
    for (const audience of ["user", "admin", "wiki"]) {
      const target = path.join(local, "logs", `e2e-last-${audience}.log`);
      yield* Effect.tryPromise(() => rm(target, { force: true }));
      yield* Effect.tryPromise(() =>
        copyFile(path.join(directory, `${audience}.log`), target).then(
          () => chmod(target, 0o600),
          () => undefined,
        ),
      );
    }
    for (const email of registrations)
      yield* attempt(
        Effect.map(findMessages(email), (ids) => {
          for (const id of ids) messages.add(id);
        }),
        "mail-search",
        errors,
      );
    if (messages.size > 0)
      yield* attempt(
        Effect.flatMap(
          fetchResponse(`${mailpit}/api/v1/messages`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ IDs: [...messages] }),
            timeout: 5000,
          }),
          (response) => ensure(response.ok, "E2E_SERVICE_HTTP_ERROR"),
        ),
        "mail-delete",
        errors,
      );
    for (const port of ports) yield* attempt(port.close, "port-reservation", errors);
    yield* ensure(
      path.dirname(directory) === local && path.basename(directory).startsWith("e2e-"),
      "E2E_UNSAFE_CLEANUP_PATH",
    );
    yield* Effect.tryPromise(() => rm(directory, { recursive: true, force: false }));
    yield* ensure(errors.length === 0, `E2E_CLEANUP_FAILED: ${[...new Set(errors)].join(",")}`);
  });

  const directory = yield* Effect.acquireRelease(
    Effect.gen(function* () {
      yield* Effect.tryPromise(() => mkdir(local, { recursive: true, mode: 0o700 }));
      const created = yield* Effect.tryPromise(() => mkdtemp(path.join(local, "e2e-")));
      yield* Effect.tryPromise(() => chmod(created, 0o700));
      return created;
    }),
    (created) => cleanup(created).pipe(Effect.orDie),
  );
  const id = path.basename(directory);
  const basicUser = `gate-${id}`;
  const basicPassword = randomBytes(32).toString("base64url");
  const authSecret = randomBytes(48).toString("base64url");
  const databaseId = randomUUID();
  const persist = path.join(directory, "d1");
  const configs: Record<string, string> = {};

  const browserConfig = path.join(directory, "agent-browser.json");
  yield* Effect.tryPromise(() => writeFile(browserConfig, "{}", { mode: 0o600 }));
  for (let index = 0; index < 3; index += 1) ports.push(yield* reservePort());
  const [userPort, adminPort, wikiPort] = ports;
  if (!userPort || !adminPort || !wikiPort) return yield* fail("E2E_PORT_ALLOCATION_FAILED");
  const userOrigin = `http://localhost:${userPort.port}`;
  const adminOrigin = `http://localhost:${adminPort.port}`;
  const wikiOrigin = `http://localhost:${wikiPort.port}`;
  const require = createRequire(import.meta.url);
  const wrangler = path.join(
    path.dirname(require.resolve("wrangler/package.json")),
    "bin/wrangler.js",
  );
  for (const [audience, origin, reservation] of [
    ["user", userOrigin, userPort],
    ["admin", adminOrigin, adminPort],
    ["wiki", wikiOrigin, wikiPort],
  ] as const) {
    const builtDirectory = path.join(root, "apps", audience, "dist");
    const builtText = yield* Effect.tryPromise(() =>
      readFile(path.join(builtDirectory, "server/wrangler.json"), "utf8"),
    );
    const built = yield* object(yield* Effect.try((): unknown => JSON.parse(builtText)));
    const entry = path.resolve(builtDirectory, "server", yield* string(built["main"]));
    yield* ensure(
      entry.startsWith(`${builtDirectory}${path.sep}`),
      "E2E_WORKER_ENTRY_OUTSIDE_BUILD",
    );
    yield* Effect.tryPromise(() => access(entry));
    yield* Effect.tryPromise(() => access(path.join(builtDirectory, "client")));
    const config = path.join(directory, `${audience}.json`);
    const envFile = path.join(directory, `${audience}.env`);
    configs[audience] = config;
    yield* Effect.tryPromise(() =>
      writeFile(
        config,
        JSON.stringify({
          name: `${id.toLowerCase()}-${audience}`,
          main: entry,
          compatibility_date: built["compatibility_date"],
          compatibility_flags: built["compatibility_flags"],
          rules: built["rules"],
          observability: built["observability"],
          no_bundle: true,
          assets: {
            directory: path.join(builtDirectory, "client"),
            binding: "ASSETS",
            run_worker_first: true,
          },
          d1_databases:
            audience === "wiki"
              ? []
              : [
                  {
                    binding: "DB",
                    database_name: `${id}-shared`,
                    database_id: databaseId,
                    migrations_dir: path.join(root, "libs/db/migrations"),
                  },
                ],
          vars: {},
          workers_dev: false,
          preview_urls: false,
        }),
        { mode: 0o600 },
      ),
    );
    yield* Effect.tryPromise(() =>
      writeFile(
        envFile,
        [
          `APP_ORIGIN=${origin}`,
          ...(audience === "wiki"
            ? []
            : [
                `AUTH_SECRET=${authSecret}`,
                "EMAIL_FROM=e2e@example.test",
                `MAILPIT_URL=${mailpit}`,
              ]),
          ...(audience === "admin"
            ? [`LOCAL_ADMIN_USER=${basicUser}`, `LOCAL_ADMIN_PASSWORD=${basicPassword}`]
            : []),
          "",
        ].join("\n"),
        { mode: 0o600 },
      ),
    );
    const launch = path.join(directory, `${audience}.fish`);
    yield* Effect.tryPromise(() =>
      writeFile(
        launch,
        `exec ${shellQuote(process.execPath)} ${shellQuote(wrangler)} dev --local --config ${shellQuote(config)} --env-file ${shellQuote(envFile)} --persist-to ${shellQuote(persist)} --ip localhost --port ${reservation.port} --inspector-port 0 --show-interactive-dev-session=false >${shellQuote(path.join(directory, `${audience}.log`))} 2>&1\n`,
        { mode: 0o600 },
      ),
    );
  }
  const userConfig = configs["user"];
  if (!userConfig) return yield* fail("E2E_USER_CONFIG_MISSING");
  yield* run(
    process.execPath,
    [
      wrangler,
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      userConfig,
      "--persist-to",
      persist,
    ],
    "",
    120_000,
  );
  for (const [audience, reservation, origin, readyPath, ready] of [
    ["user", userPort, userOrigin, "/login", 200],
    ["admin", adminPort, adminOrigin, "/login", 401],
    ["wiki", wikiPort, wikiOrigin, "/", 200],
  ] as const) {
    yield* reservation.close;
    const session = `${id}-${audience}`;
    yield* run("tmux", [
      "new-session",
      "-d",
      "-s",
      session,
      "-c",
      directory,
      `/opt/homebrew/bin/fish ${shellQuote(path.join(directory, `${audience}.fish`))}`,
    ]);
    sessions.add(session);
    yield* poll(
      fetchResponse(`${origin}${readyPath}`, { timeout: 2000 }).pipe(
        Effect.map((response) => response.status),
        Effect.orElseSucceed(() => 0),
      ),
      (status) => status === ready,
      "E2E_WORKER_STARTUP_FAILED",
      90_000,
    );
  }

  return {
    userOrigin,
    adminOrigin,
    wikiOrigin,
    basicUser,
    basicPassword,
    messages,
    account(name: string) {
      const email = `${id.toLowerCase()}-${name}@example.test`;
      registrations.add(email);
      return { email, password: randomBytes(32).toString("base64url"), name: `E2E ${name}` };
    },
    browser(name: string) {
      const value = makeBrowser(`${id}-${name}`, browserConfig);
      browsers.add(value);
      return value;
    },
    bootstrap: Effect.fn("bootstrap")(function* (email: string) {
      yield* run(
        process.execPath,
        [fileURLToPath(new URL("bootstrap.ts", import.meta.url))],
        JSON.stringify({ config: userConfig, persist: path.join(persist, "v3"), email }),
      );
    }),
    stopUser: Effect.fn("stopUser")(function* () {
      const session = `${id}-user`;
      if (sessions.has(session)) {
        yield* run("tmux", ["kill-session", "-t", session]);
        sessions.delete(session);
      }
      yield* poll(
        fetchResponse(`${userOrigin}/login`, { timeout: 500 }).pipe(
          Effect.as(false),
          Effect.orElseSucceed(() => true),
        ),
        (closed) => closed,
        "E2E_USER_WORKER_DID_NOT_STOP",
        10_000,
      );
    }),
  };
});

export type Stack = Effect.Success<ReturnType<typeof createStack>>;
