// oxlint-disable-next-line import/no-nodejs-modules
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, stat } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { createServer } from "node:http";

import { Auth } from "@repo/auth";
import { applicationOrigins } from "@repo/config";
import { Database } from "@repo/db";
import { ensureAdminRole } from "@repo/db/bootstrap";
import { localDatabaseStore, writeLocalDatabaseConfig } from "@repo/db/local";
import { createEmailVerificationToken } from "better-auth/api";
import { Effect, Layer, Schema } from "effect";
import { URI } from "otpauth";
import { getPlatformProxy } from "wrangler";

import { failure, fileIo } from "./failure.ts";
import { local, readCredentials } from "./local-environment.ts";
import { assertOwnerOnly, isErrorCode, replacePrivateFile } from "./private-files.ts";

import type { D1Database } from "@cloudflare/workers-types";
import type { LocalCommandFailure } from "./failure.ts";

const OPERATOR_EMAIL = "local-operator@example.test";
const OPERATOR_NAME = "Local Operator";
const PASSWORD_BYTES = 24;
const HTTP_OK = 200;
const jsonIndentation = 2;
const operatorFile = new URL("operator.json", local);

const OperatorFile = Schema.Struct({
  email: Schema.String,
  name: Schema.String,
  password: Schema.String.check(Schema.isMinLength(12)),
  totpURI: Schema.String,
});

type Operator = typeof OperatorFile.Type;

const TotpEnrollment = Schema.Struct({
  backupCodes: Schema.Array(Schema.String),
  totpURI: Schema.String,
});

type AuthService = Auth["Service"];

const platform = Effect.acquireRelease(
  Effect.promise(async () =>
    getPlatformProxy<{ DB: D1Database }>({
      configPath: await writeLocalDatabaseConfig(),
      envFiles: [],
      persist: { path: localDatabaseStore() },
      remoteBindings: false,
    }),
  ),
  (proxy) => Effect.promise(async () => proxy.dispose()),
);

const mailSink = Effect.acquireRelease(
  Effect.promise(async () => {
    const server = createServer((_request, response) => {
      response.writeHead(HTTP_OK, { "content-type": "application/json" });
      response.end(JSON.stringify({ ID: crypto.randomUUID() }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      server.close();
      throw new Error("MAIL_SINK_UNAVAILABLE");
    }
    return { origin: `http://127.0.0.1:${address.port}`, server };
  }),
  ({ server }) =>
    Effect.promise(
      async () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
        }),
    ),
);

class CookieJar {
  public readonly cookies = new Map<string, string>();

  public headers(origin: string): Headers {
    const cookie = [...this.cookies]
      .map(([key, value]: readonly [string, string]) => `${key}=${value}`)
      .join("; ");
    return new Headers({ cookie, origin });
  }

  public store(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      if (pair === undefined || pair === "") {
        continue;
      }
      const separator = pair.indexOf("=");
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value === "") {
        this.cookies.delete(key);
        continue;
      }
      this.cookies.set(key, value);
    }
  }
}

function authRequest(
  auth: AuthService,
  jar: CookieJar,
  origin: string,
  endpoint: string,
  body?: Readonly<Record<string, unknown>>,
): Effect.Effect<Response> {
  const headers = jar.headers(origin);
  headers.set("content-type", "application/json");
  return Effect.promise(async () => {
    const response = await auth.instance.handler(
      new Request(`${origin}/api/auth${endpoint}`, {
        headers,
        method: body === undefined ? "GET" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    jar.store(response);
    return response;
  });
}

function operatorExists(): Effect.Effect<boolean, LocalCommandFailure> {
  return Effect.tryPromise({
    catch: (cause): Readonly<{ missing: boolean }> => ({ missing: isErrorCode(cause, "ENOENT") }),
    try: async () => stat(operatorFile),
  }).pipe(
    Effect.matchEffect({
      onFailure: ({ missing }) =>
        missing ? Effect.succeed(false) : Effect.fail(failure("file_io_failed")),
      onSuccess: () => Effect.succeed(true),
    }),
  );
}

const readOperator = Effect.fn("readOperator")(function* readOperator() {
  yield* assertOwnerOnly(operatorFile);
  const text = yield* fileIo(async () => readFile(operatorFile, "utf-8"));
  const json = yield* Effect.try({
    catch: () => failure("credentials_invalid"),
    try: (): unknown => JSON.parse(text),
  });
  return yield* Schema.decodeUnknownEffect(OperatorFile)(json).pipe(
    Effect.mapError(() => failure("credentials_invalid")),
  );
});

const writeOperator = Effect.fn("writeOperator")(function* writeOperator(operator: Operator) {
  yield* replacePrivateFile(
    operatorFile,
    `${JSON.stringify(operator, undefined, jsonIndentation)}\n`,
  );
});

const enrollTotp = Effect.fn("enrollTotp")(function* enrollTotp(
  auth: AuthService,
  jar: CookieJar,
  origin: string,
  password: string,
) {
  const enabled = yield* authRequest(auth, jar, origin, "/two-factor/enable", { password });
  if (enabled.status !== HTTP_OK) {
    return yield* failure("operator_provision_failed");
  }
  const enrollment = yield* Effect.tryPromise({
    catch: () => failure("operator_provision_failed"),
    try: async () => enabled.json(),
  }).pipe(
    Effect.flatMap((body) =>
      Schema.decodeUnknownEffect(TotpEnrollment)(body).pipe(
        Effect.mapError(() => failure("operator_provision_failed")),
      ),
    ),
  );
  const code = URI.parse(enrollment.totpURI).generate();
  const verified = yield* authRequest(auth, jar, origin, "/two-factor/verify-totp", { code });
  if (verified.status !== HTTP_OK) {
    return yield* failure("operator_provision_failed");
  }
  return enrollment.totpURI;
});

const createOperator = Effect.fn("createOperator")(function* createOperator(
  auth: AuthService,
  origin: string,
  secret: string,
) {
  const password = randomBytes(PASSWORD_BYTES).toString("base64url");
  const jar = new CookieJar();
  const signedUp = yield* authRequest(auth, jar, origin, "/sign-up/email", {
    email: OPERATOR_EMAIL,
    name: OPERATOR_NAME,
    password,
  });
  if (!signedUp.ok) {
    return yield* failure("operator_provision_failed");
  }
  const token = yield* Effect.promise(async () =>
    createEmailVerificationToken(secret, OPERATOR_EMAIL),
  );
  yield* Effect.promise(async () => auth.instance.api.verifyEmail({ query: { token } }));
  const signedIn = yield* authRequest(auth, jar, origin, "/sign-in/email", {
    email: OPERATOR_EMAIL,
    password,
  });
  if (signedIn.status !== HTTP_OK) {
    return yield* failure("operator_provision_failed");
  }
  const totpURI = yield* enrollTotp(auth, jar, origin, password);
  yield* ensureAdminRole(OPERATOR_EMAIL).pipe(
    Effect.mapError(() => failure("operator_provision_failed")),
  );
  const operator: Operator = {
    email: OPERATOR_EMAIL,
    name: OPERATOR_NAME,
    password,
    totpURI,
  };
  yield* writeOperator(operator);
  return operator;
});

const ensureOperator = Effect.fn("ensureOperator")(function* ensureOperator() {
  if (yield* operatorExists()) {
    return yield* readOperator();
  }
  const credentials = yield* readCredentials();
  const origin = applicationOrigins["service-member"];
  return yield* Effect.scoped(
    Effect.gen(function* provision() {
      const sink = yield* mailSink;
      const { env } = yield* platform;
      const authLayer = Auth.layer({
        audience: "service-member",
        baseURL: origin,
        mail: { EMAIL_FROM: "no-reply@example.test", MAILPIT_URL: sink.origin },
        secret: credentials.authSecret,
      }).pipe(Layer.provideMerge(Database.layer(env.DB)));
      return yield* Effect.gen(function* useAuth() {
        return yield* createOperator(yield* Auth, origin, credentials.authSecret);
      }).pipe(
        Effect.provide(authLayer),
        Effect.mapError((cause): LocalCommandFailure => {
          if (
            typeof cause === "object" &&
            cause !== null &&
            "_tag" in cause &&
            cause._tag === "LocalCommandFailure"
          ) {
            return cause;
          }
          return failure("operator_provision_failed");
        }),
      );
    }),
  );
});

export { ensureOperator, operatorExists, operatorFile };
export type { Operator };
