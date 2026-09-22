import { NodeHttpServer } from "@effect/platform-node";
import { Auth } from "@repo/auth";
import { APPLICATION, applicationOrigins, mailpitSendPath } from "@repo/config";
import { Database } from "@repo/db";
import { localDatabasePlatform } from "@repo/db-local";
import { ensureAdminRole } from "@repo/db/bootstrap";
import { createEmailVerificationToken } from "better-auth/api";
import {
  Context,
  Crypto,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Path,
  PlatformError,
  Schema,
  Scope,
} from "effect";
import { HttpServer, HttpServerResponse } from "effect/unstable/http";
import { URI } from "otpauth";

import { failure } from "./failure.ts";
import { local, readCredentials } from "./local-environment.ts";
import { isNotFound, urlPath, withFileSystem } from "./platform.ts";
import { assertOwnerOnly, replacePrivateFile } from "./private-files.ts";

import type { LocalCommandFailure } from "./failure.ts";

const OPERATOR_EMAIL = "local-operator@example.test";
const OPERATOR_NAME = "Local Operator";
const PASSWORD_BYTES = 24;
const HTTP_OK = 200;
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

const MailId = Schema.Struct({ ID: Schema.String });

type AuthService = Auth["Service"];

const mailSink = Effect.acquireRelease(
  Effect.gen(function* openMail() {
    const scope = yield* Scope.make();
    const built = yield* Layer.build(NodeHttpServer.layerTest).pipe(
      Scope.provide(scope),
      Effect.mapError(() => failure("operator_provision_failed")),
    );
    const server = Context.get(built, HttpServer.HttpServer);
    yield* server
      .serve(
        Effect.gen(function* reply() {
          const crypto = yield* Crypto.Crypto;
          const id = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
          return yield* HttpServerResponse.schemaJson(MailId)({ ID: id }).pipe(Effect.orDie);
        }),
      )
      .pipe(Scope.provide(scope));
    if (server.address._tag !== "TcpAddress") {
      return yield* failure("operator_provision_failed");
    }
    return { origin: `http://127.0.0.1:${server.address.port}`, scope };
  }),
  ({ scope }) => Scope.close(scope, Exit.succeed(undefined)).pipe(Effect.ignore),
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
  return Effect.gen(function* authRequestProgram() {
    const headers = jar.headers(origin);
    headers.set("content-type", "application/json");
    const encoded =
      body === undefined
        ? undefined
        : yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(body);
    const response = yield* Effect.promise(() =>
      auth.instance.handler(
        new Request(`${origin}/api/auth${endpoint}`, {
          headers,
          method: body === undefined ? "GET" : "POST",
          ...(encoded === undefined ? {} : { body: encoded }),
        }),
      ),
    );
    jar.store(response);
    return response;
  }).pipe(Effect.orDie);
}

function operatorExists(): Effect.Effect<
  boolean,
  LocalCommandFailure,
  FileSystem.FileSystem | Path.Path
> {
  return urlPath(operatorFile).pipe(
    Effect.flatMap((path) =>
      FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.stat(path)),
        Effect.as(true),
        Effect.catchIf(
          (error): error is PlatformError.PlatformError => isNotFound(error),
          () => Effect.succeed(false),
        ),
        Effect.mapError(() => failure("file_io_failed")),
      ),
    ),
  );
}

const readOperator = Effect.fn("readOperator")(function* readOperator() {
  yield* assertOwnerOnly(operatorFile);
  const path = yield* urlPath(operatorFile);
  const text = yield* withFileSystem((fs) => fs.readFileString(path));
  return yield* Schema.decodeEffect(Schema.fromJsonString(OperatorFile))(text).pipe(
    Effect.mapError(() => failure("credentials_invalid")),
  );
});

const writeOperator = Effect.fn("writeOperator")(function* writeOperator(operator: Operator) {
  const content = yield* Schema.encodeEffect(Schema.fromJsonString(OperatorFile))(operator).pipe(
    Effect.orDie,
  );
  yield* replacePrivateFile(operatorFile, `${content}\n`);
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
  const enrollment = yield* Effect.promise(() => enabled.json()).pipe(
    Effect.mapError(() => failure("operator_provision_failed")),
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
  const crypto = yield* Crypto.Crypto;
  const bytes = yield* crypto.randomBytes(PASSWORD_BYTES).pipe(Effect.orDie);
  const password = Buffer.from(bytes).toString("base64url");
  const jar = new CookieJar();
  const signedUp = yield* authRequest(auth, jar, origin, "/sign-up/email", {
    email: OPERATOR_EMAIL,
    name: OPERATOR_NAME,
    password,
  });
  if (!signedUp.ok) {
    return yield* failure("operator_provision_failed");
  }
  const token = yield* Effect.promise(() =>
    Promise.resolve(createEmailVerificationToken(secret, OPERATOR_EMAIL)),
  );
  yield* Effect.promise(() => Promise.resolve(auth.instance.api.verifyEmail({ query: { token } })));
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
  const origin = applicationOrigins[APPLICATION.user];
  return yield* Effect.scoped(
    Effect.gen(function* provision() {
      const sink = yield* mailSink;
      const { env } = yield* localDatabasePlatform;
      const authLayer = Auth.layer({
        audience: APPLICATION.user,
        baseURL: origin,
        mail: {
          APP_ORIGIN: origin,
          EMAIL_FROM: "no-reply@example.test",
          MAILPIT_SEND_URL: `${sink.origin}${mailpitSendPath}`,
        },
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
