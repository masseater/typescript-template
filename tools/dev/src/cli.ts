import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createHash, createPublicKey, randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { applicationPorts, applications, loopbackHosts } from "@template/config";
import type { Application } from "@template/config";
import { Cause, Effect, Schema } from "effect";

class LocalCommandFailure extends Schema.TaggedError<LocalCommandFailure>()("LocalCommandFailure", {
  reason: Schema.Literals([
    "command_unsupported",
    "app_invalid",
    "file_io_failed",
    "process_failed",
    "credentials_permissions_invalid",
    "credentials_invalid",
    "configuration_exists",
    "configuration_differs",
    "browser_socket_directory_invalid",
    "browser_start_failed",
    "browser_authentication_failed",
    "browser_command_required",
  ]),
}) {}

type FailureReason = LocalCommandFailure["reason"];

const failure = (reason: FailureReason) => new LocalCommandFailure({ reason });

const fileIo = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({ try: operation, catch: () => failure("file_io_failed") });

const execFileAsync = promisify(execFile);

const run = (file: string, args: readonly string[], options: Parameters<typeof execFileAsync>[2]) =>
  Effect.tryPromise({
    try: () => execFileAsync(file, args, options),
    catch: () => failure("process_failed"),
  });

const errorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? error.code : undefined;

const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const rootHash = createHash("sha256").update(root).digest("hex").slice(0, 12);
const socket = `template-${rootHash}`;
const AppName = Schema.Literals(applications);
const Credentials = Schema.Struct({
  authSecret: Schema.String.check(Schema.isMinLength(32)),
});
const routes = { ...applicationPorts, mailpit: 8025 };
const routeNames = [...applications, "mailpit"] as const;
const hostname = (name: (typeof routeNames)[number]) => `template-${name}.local`;
const origin = (name: (typeof routeNames)[number]) => `https://${hostname(name)}`;
const proxyPort = 1355;
const portlessHome = new URL("portless/", local);
const portless = fileURLToPath(new URL("../node_modules/.bin/portless", import.meta.url));
const portlessEnvironment = {
  ...process.env,
  PORTLESS_STATE_DIR: fileURLToPath(portlessHome),
  PORTLESS_SYNC_HOSTS: "0",
};
const browserSettings = `${JSON.stringify({
  allowedDomains: [...loopbackHosts, ...routeNames.map((name) => hostname(name))],
  restoreSave: "never",
})}\n`;

const browserLaunchArguments = Effect.fn("browserLaunchArguments")(function* () {
  const certificate = yield* fileIo(() => readFile(new URL("ca.pem", portlessHome), "utf8"));
  const authority = yield* Effect.try({
    try: () => createPublicKey(certificate),
    catch: () => failure("file_io_failed"),
  });
  const pin = createHash("sha256")
    .update(authority.export({ type: "spki", format: "der" }))
    .digest("base64");
  return [
    "--args",
    `--ignore-certificate-errors-spki-list=${pin},--host-resolver-rules=MAP template-*.local 127.0.0.1`,
  ];
});

const running = (session: string) =>
  run("tmux", ["-L", socket, "has-session", "-t", session], { cwd: root }).pipe(
    Effect.match({ onFailure: () => false, onSuccess: () => true }),
  );

const ensureGateway = Effect.fn("ensureGateway")(function* () {
  yield* fileIo(() => mkdir(portlessHome, { recursive: true, mode: 0o700 }));
  yield* run(portless, ["proxy", "start", "--lan", "--port", String(proxyPort)], {
    cwd: root,
    env: portlessEnvironment,
    timeout: 60_000,
  });
  for (const name of routeNames)
    yield* run(portless, ["alias", `template-${name}`, String(routes[name]), "--force"], {
      cwd: root,
      env: portlessEnvironment,
      timeout: 30_000,
    });
  if (!(yield* running("gateway"))) {
    const log = fileURLToPath(new URL("logs/gateway.log", local));
    const command = `exec node ${JSON.stringify(fileURLToPath(new URL("gateway.ts", import.meta.url)))} ${proxyPort} >> ${JSON.stringify(log)} 2>&1`;
    yield* run(
      "tmux",
      ["-L", socket, "new-session", "-d", "-s", "gateway", "-c", root, "fish", "-c", command],
      { cwd: root },
    );
  }
});

const replacePrivateFile = Effect.fn("replacePrivateFile")(function* (path: URL, content: string) {
  yield* Effect.acquireUseRelease(
    fileIo(() => open(path, "w", 0o600)),
    (file) => fileIo(() => file.writeFile(content)),
    (file) => fileIo(() => file.close()),
  );
  yield* fileIo(() => chmod(path, 0o600));
});

const readyPaths = { user: "/login", admin: "/login", wiki: "/" };

const requirePrivatePermissions = Effect.fn("requirePrivatePermissions")(function* (path: URL) {
  const entry = yield* fileIo(() => stat(path));
  if ((entry.mode & 0o077) !== 0) return yield* failure("credentials_permissions_invalid");
});

const writePrivateFile = Effect.fn("writePrivateFile")(function* (path: URL, content: string) {
  yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () => open(path, "wx", 0o600),
      catch: (error) =>
        failure(errorCode(error) === "EEXIST" ? "configuration_exists" : "file_io_failed"),
    }),
    (file) => fileIo(() => file.writeFile(content)),
    (file) => fileIo(() => file.close()),
  ).pipe(
    Effect.catchIf(
      (error) => error.reason === "configuration_exists",
      () =>
        fileIo(() => readFile(path, "utf8")).pipe(
          Effect.flatMap((existing) =>
            existing === content ? Effect.void : Effect.fail(failure("configuration_differs")),
          ),
        ),
    ),
  );
  yield* requirePrivatePermissions(path);
});

const readCredentials = Effect.fn("readCredentials")(function* () {
  yield* requirePrivatePermissions(credentialsFile);
  const text = yield* fileIo(() => readFile(credentialsFile, "utf8"));
  const json = yield* Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: () => failure("credentials_invalid"),
  });
  return yield* Schema.decodeUnknownEffect(Credentials)(json).pipe(
    Effect.mapError(() => failure("credentials_invalid")),
  );
});

const browserSocketDirectory = Effect.fn("browserSocketDirectory")(function* () {
  const directory = join(tmpdir(), `ab-${rootHash}`);
  yield* fileIo(() => mkdir(directory, { recursive: true, mode: 0o700 }));
  const entry = yield* fileIo(() => lstat(directory));
  if (!entry.isDirectory() || entry.uid !== process.getuid?.())
    return yield* failure("browser_socket_directory_invalid");
  yield* fileIo(() => chmod(directory, 0o700));
  return directory;
});

const setup = Effect.fn("setup")(function* () {
  yield* fileIo(() => mkdir(local, { recursive: true, mode: 0o700 }));
  yield* fileIo(() => mkdir(new URL("logs/", local), { recursive: true, mode: 0o700 }));
  yield* browserSocketDirectory();
  yield* replacePrivateFile(browserConfig, browserSettings);
  const exists = yield* fileIo(() =>
    stat(credentialsFile).then(
      () => true,
      (error: unknown) => (errorCode(error) === "ENOENT" ? false : Promise.reject(error)),
    ),
  );
  if (!exists)
    yield* writePrivateFile(
      credentialsFile,
      `${JSON.stringify({ authSecret: randomBytes(48).toString("base64url") }, null, 2)}\n`,
    );
  const credentials = yield* readCredentials();
  for (const app of applications) {
    const values = {
      APP_ORIGIN: origin(app),
      AUTH_SECRET: credentials.authSecret,
      EMAIL_FROM: "no-reply@example.test",
      MAILPIT_URL: `http://127.0.0.1:${routes.mailpit}`,
    };
    const content =
      Object.entries(values)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join("\n") + "\n";
    yield* replacePrivateFile(new URL(`../../../apps/${app}/.dev.vars`, import.meta.url), content);
  }
  return {
    ok: true,
    event: "local.app_configuration_ready",
    credentialsFile: fileURLToPath(credentialsFile),
    secretsPrinted: false,
  };
});

const status = Effect.fn("status")(function* () {
  const results = yield* Effect.forEach(
    applications,
    (app) =>
      Effect.gen(function* () {
        const live = yield* running(app);
        const response = yield* Effect.tryPromise((signal) =>
          fetch(`http://127.0.0.1:${applicationPorts[app]}${readyPaths[app]}`, {
            redirect: "manual",
            signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
          }),
        ).pipe(Effect.match({ onFailure: () => null, onSuccess: (result) => result.status }));
        return {
          app,
          processRunning: live,
          httpStatus: response,
          origin: origin(app),
          logFile: fileURLToPath(new URL(`logs/${app}.log`, local)),
        };
      }),
    { concurrency: "unbounded" },
  );
  return {
    event: "local.application_status",
    functionalVerification: "not-proven-by-status",
    apps: results,
  };
});

const connection = Effect.fn("connection")(function* () {
  yield* ensureGateway();
  const certificate = yield* fileIo(() => readFile(new URL("ca.pem", portlessHome)));
  return {
    event: "local.lan_access",
    reachableFrom: "devices on the same LAN that trust the local certificate authority",
    ...Object.fromEntries(routeNames.map((name) => [name, origin(name)])),
    windowsTrustCommand: `$p = Join-Path $env:TEMP 'template-local-ca.cer'; [IO.File]::WriteAllBytes($p, [Convert]::FromBase64String('${certificate.toString("base64")}')); Import-Certificate -FilePath $p -CertStoreLocation Cert:\\CurrentUser\\Root`,
  };
});

const start = Effect.fn("start")(function* (app: Application) {
  yield* readCredentials();
  yield* ensureGateway();
  if (!(yield* running(app))) {
    const log = fileURLToPath(new URL(`logs/${app}.log`, local));
    yield* Effect.acquireUseRelease(
      fileIo(() => open(log, "a", 0o600)),
      () => Effect.void,
      (file) => fileIo(() => file.close()),
    );
    yield* fileIo(() => chmod(log, 0o600));
    const vp = JSON.stringify(join(root, "node_modules/.bin/vp"));
    const command = `exec ${vp} run --filter @template/${app} preview >> ${JSON.stringify(log)} 2>&1`;
    yield* run(
      "tmux",
      ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
      { cwd: root },
    );
  }
  return yield* status();
});

const stop = Effect.fn("stop")(function* (app: Application) {
  if (yield* running(app))
    yield* run("tmux", ["-L", socket, "kill-session", "-t", app], { cwd: root });
  return yield* status();
});

type ChildExit =
  | { readonly started: false }
  | { readonly started: true; readonly code: number | null };

const spawnChild = (launch: () => ChildProcess) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => {
        const child = launch();
        const exited = new Promise<ChildExit>((resolve) => {
          child.once("error", () => resolve({ started: false }));
          child.once("exit", (code) => resolve({ started: true, code }));
        });
        return { child, exited };
      },
      catch: () => failure("browser_start_failed"),
    }),
    ({ child }) =>
      Effect.sync(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill();
      }),
  );

const browser = Effect.fn("browser")(function* (app: Application) {
  const socketDirectory = yield* browserSocketDirectory();
  yield* replacePrivateFile(browserConfig, browserSettings);
  const session = `template-local-${app}`;
  const args = [
    "--config",
    fileURLToPath(browserConfig),
    ...(yield* browserLaunchArguments()),
    "--session",
    session,
  ];
  const env = { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  yield* run("agent-browser", [...args, "open", `${origin(app)}${readyPaths[app]}`], {
    cwd: root,
    env,
  });
  return {
    ok: true,
    event: "local.browser_opened",
    session,
    origin: origin(app),
    secretsPrinted: false,
  };
});

const browserCommand = Effect.fn("browserCommand")(function* (app: Application, args: string[]) {
  if (args.length === 0) return yield* failure("browser_command_required");
  const socketDirectory = yield* browserSocketDirectory();
  const launchArguments = yield* browserLaunchArguments();
  yield* Effect.scoped(
    Effect.gen(function* () {
      const { exited } = yield* spawnChild(() =>
        spawn(
          "agent-browser",
          [
            "--config",
            fileURLToPath(browserConfig),
            ...launchArguments,
            "--session",
            `template-local-${app}`,
            ...args,
          ],
          {
            cwd: root,
            env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory },
            stdio: "inherit",
          },
        ),
      );
      const exit = yield* Effect.promise(() => exited);
      if (!exit.started) return yield* failure("browser_start_failed");
      if (exit.code !== 0) process.exitCode = exit.code ?? 1;
    }),
  );
});

const print = (value: unknown) => Effect.sync(() => console.log(JSON.stringify(value)));

const application = (value: string | undefined) =>
  Schema.decodeUnknownEffect(AppName)(value).pipe(Effect.mapError(() => failure("app_invalid")));

const commands: Partial<
  Record<
    string,
    (app: string | undefined, args: string[]) => Effect.Effect<unknown, LocalCommandFailure>
  >
> = {
  setup: () => setup(),
  status: () => status(),
  connect: () => connection(),
  start: (app) => application(app).pipe(Effect.flatMap(start)),
  stop: (app) => application(app).pipe(Effect.flatMap(stop)),
  browser: (app) => application(app).pipe(Effect.flatMap(browser)),
  "browser-command": (app, args) =>
    application(app).pipe(Effect.flatMap((name) => browserCommand(name, args))),
  logs: (app) =>
    application(app).pipe(
      Effect.flatMap((name) =>
        fileIo(() => readFile(new URL(`logs/${name}.log`, local), "utf8")).pipe(
          Effect.map((log) => ({ app: name, log })),
        ),
      ),
    ),
};

const main = Effect.gen(function* () {
  const [action = "", app, ...args] = process.argv.slice(2);
  const command = Object.hasOwn(commands, action) ? commands[action] : undefined;
  if (!command) return yield* failure("command_unsupported");
  const result = yield* command(app, args);
  if (result !== undefined) yield* print(result);
});

NodeRuntime.runMain(
  main.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : Effect.sync(() => {
            console.error(
              JSON.stringify({
                ok: false,
                event: "local.application_command_failed",
                remediation:
                  "Check vp run --filter @template/dev setup, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
              }),
            );
            process.exitCode = 1;
          }),
    ),
  ),
  { disableErrorReporting: true },
);
