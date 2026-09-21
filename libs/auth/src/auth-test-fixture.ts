import {
  ADMIN_PERMISSION,
  APPLICATION,
  ROLE,
  STAFF_PERMISSION,
  type AccountPermission,
  type Application,
  type Role,
} from "@repo/config";
import {
  EmptyTestDatabase,
  TestDatabase,
  BOOTSTRAP_KIND,
  bootstrapAdmin,
  getSchemaShape,
  runStatement,
  type BootstrapKind,
} from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { makeSignature } from "better-auth/crypto";
import { getSchema } from "better-auth/db";
import { Context, Effect, Exit, Layer, Ref, Schema, Scope } from "effect";
import { URI } from "otpauth";
import { test } from "vite-plus/test";

import { AuthIdentifiers, type GenerateId } from "./auth-identifiers.ts";
import { Auth } from "./auth.ts";
import { BrowserClient, origins } from "./browser-client.ts";
import { mailConfig, mailServer, verificationLink } from "./mail-fixture.ts";
import { SessionRequired } from "./session-required.ts";
import { UnexpectedStatus } from "./unexpected-status.ts";

import type { Database } from "@repo/db";
import type { AuthFailure } from "./auth-failure.ts";

const PASSWORD = "test-password-safe-123";
const authTestSecret = "integration-test-secret-at-least-32-characters-long";
const TotpEnrollment = Schema.Struct({
  backupCodes: Schema.Array(Schema.String),
  totpURI: Schema.String,
});

class AuthApps extends Context.Service<AuthApps, Readonly<Record<Application, Auth["Service"]>>>()(
  "@repo/auth/AuthApps",
) {}

const sequentialIdentifiers = Layer.effect(
  AuthIdentifiers,
  Effect.map(
    Ref.make<Readonly<Partial<Record<string, number>>>>({}),
    (issued): GenerateId =>
      ({ model }) =>
        Effect.runSync(
          Ref.modify(issued, (issuedCounts) => {
            const sequence = (issuedCounts[model] ?? 0) + 1;
            return [`${model}-${sequence}`, { ...issuedCounts, [model]: sequence }];
          }),
        ),
  ),
);

const authFor = (
  audience: Application,
): Effect.Effect<Auth["Service"], AuthFailure, Database | Scope.Scope> => {
  const layer = Auth.layer({
    audience,
    baseURL: origins[audience],
    secret: authTestSecret,
    mail: { ...mailConfig, APP_ORIGIN: origins[audience] },
  });
  return Layer.build(layer).pipe(Effect.map((built) => Context.get(built, Auth)));
};

const authApps = Layer.effect(
  AuthApps,
  Effect.all({
    [APPLICATION.admin]: authFor(APPLICATION.admin),
    [APPLICATION.user]: authFor(APPLICATION.user),
    [APPLICATION.wiki]: authFor(APPLICATION.wiki),
  }),
).pipe(Layer.provide(sequentialIdentifiers));

const authTestLayer = authApps.pipe(
  Layer.provideMerge(TestDatabase),
  Layer.provideMerge(mailServer),
);

type AuthTestServices = Layer.Success<typeof authTestLayer>;

const provideAuth = async (
  {},
  { onCleanup }: { readonly onCleanup: (cleanup: () => Promise<void>) => void },
): Promise<Context.Context<AuthTestServices>> => {
  const scope = Scope.makeUnsafe();
  onCleanup(async () => Effect.runPromise(Scope.close(scope, Exit.void)));
  return Effect.runPromise(Layer.buildWithScope(authTestLayer, scope));
};

const authTest = () => test.extend("auth", provideAuth);

const runWith = async <Value, Failure>(
  auth: Context.Context<AuthTestServices>,
  program: () => Effect.Effect<Value, Failure, AuthTestServices>,
): Promise<Value> => {
  return Effect.runPromise(Effect.provideContext(program(), auth));
};

const withAuth = <Value, Failure>(
  effect: Effect.Effect<Value, Failure, AuthTestServices>,
): Effect.Effect<Value, Failure | AuthFailure> =>
  Effect.scoped(Effect.provide(effect, authTestLayer));

const audienceOnEmptyDatabase = (
  audience: Application,
): Effect.Effect<"AuthFailure" | Application, unknown> => {
  return Effect.scoped(authFor(audience)).pipe(
    Effect.match({
      onFailure: (failure) => failure._tag,
      onSuccess: (built) => built.audience,
    }),
    Effect.provide(Layer.merge(EmptyTestDatabase, sequentialIdentifiers)),
  );
};

const requireStatus = Effect.fn("requireStatus")(function* requireStatus(
  expectedStatus: number,
  {
    client,
    endpoint,
    jsonFields,
  }: {
    readonly client: BrowserClient;
    readonly endpoint: string;
    readonly jsonFields?: Readonly<Record<string, unknown>>;
  },
) {
  const receivedStatus = yield* client.status(endpoint, jsonFields);
  if (receivedStatus !== expectedStatus) {
    return yield* new UnexpectedStatus({ endpoint, status: receivedStatus });
  }
});

const clientOf = Effect.fn("clientOf")(function* clientOf(
  audience: Application,
  network: Readonly<Record<string, string>> = {},
) {
  return new BrowserClient((yield* AuthApps)[audience], { network });
});

const register = Effect.fn("register")(function* register(email: string) {
  const client = yield* clientOf(APPLICATION.user);
  yield* requireStatus(httpStatus.ok, {
    client,
    endpoint: "/sign-up/email",
    jsonFields: { email, name: email, password: PASSWORD },
  });
  return client;
});

const verifyEmail = Effect.fn("verifyEmail")(function* verifyEmail(email: string) {
  const member = (yield* AuthApps)[APPLICATION.user];
  const link = yield* verificationLink(email);
  const token = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
  yield* Effect.promise(async () => member.instance.api.verifyEmail({ query: { token } }));
});

const registerVerified = Effect.fn("registerVerified")(function* registerVerified(email: string) {
  const client = yield* register(email);
  yield* verifyEmail(email);
  return client;
});

const bootstrapVerifiedAdmin = Effect.fn("bootstrapVerifiedAdmin")(function* bootstrapVerifiedAdmin(
  email: string,
  kind: typeof BootstrapKind.Type = BOOTSTRAP_KIND.admin,
) {
  yield* registerVerified(email);
  yield* bootstrapAdmin(email, kind);
});

const bootstrapVerifiedStaff = Effect.fn("bootstrapVerifiedStaff")(function* bootstrapVerifiedStaff(
  email: string,
) {
  yield* bootstrapVerifiedAdmin(email, BOOTSTRAP_KIND.staff);
});

const signIn = (client: BrowserClient, email: string): Effect.Effect<number> => {
  return client.status("/sign-in/email", { email, password: PASSWORD });
};

const signInAs = Effect.fn("signInAs")(function* signInAs(audience: Application, email: string) {
  const client = yield* clientOf(audience);
  yield* requireStatus(httpStatus.ok, {
    client,
    endpoint: "/sign-in/email",
    jsonFields: { email, password: PASSWORD },
  });
  return client;
});

const enableTotp = Effect.fn("enableTotp")(function* enableTotp(client: BrowserClient) {
  const enabled = yield* client.json("/two-factor/enable", { password: PASSWORD });
  const enrollment = yield* Schema.decodeUnknownEffect(TotpEnrollment)(enabled.body);
  const authenticator = URI.parse(enrollment.totpURI);
  yield* requireStatus(httpStatus.ok, {
    client,
    endpoint: "/two-factor/verify-totp",
    jsonFields: { code: authenticator.generate() },
  });
  return { authenticator, backupCodes: enrollment.backupCodes, totpURI: enrollment.totpURI };
});

const sessionBeforeEnrollment = Effect.fn("sessionBeforeEnrollment")(
  function* sessionBeforeEnrollment({
    audience,
    email,
    enrollOn,
  }: {
    readonly audience: Application;
    readonly email: string;
    readonly enrollOn: Application;
  }) {
    const old = yield* signInAs(audience, email);
    const enrollment = yield* enableTotp(yield* signInAs(enrollOn, email));
    return { enrollment, old };
  },
);

const SIGN_IN_WINDOW = 4;

const spendSignInWindow = Effect.fn("spendSignInWindow")(function* spendSignInWindow({
  email,
  network,
}: {
  readonly email: string;
  readonly network: Readonly<Record<string, string>>;
}) {
  yield* registerVerified(email);
  const client = yield* clientOf(APPLICATION.user, network);
  return yield* Effect.replicateEffect(signIn(client, email), SIGN_IN_WINDOW);
});

const pendingSecondFactor = Effect.fn("pendingSecondFactor")(function* pendingSecondFactor(
  audience: Application,
  email: string,
) {
  const client = yield* clientOf(audience);
  const challenge = yield* client.json("/sign-in/email", { email, password: PASSWORD });
  return challenge.status === httpStatus.ok
    ? client
    : yield* new UnexpectedStatus({
        endpoint: "/sign-in/email",
        status: challenge.status,
      });
});

const signInAgainAfterTotp = Effect.fn("signInAgainAfterTotp")(function* signInAgainAfterTotp({
  audience,
  email,
}: {
  readonly audience: Application;
  readonly email: string;
}) {
  const enrolled = yield* signInAs(audience, email);
  const { authenticator } = yield* enableTotp(enrolled);
  yield* requireStatus(httpStatus.ok, { client: enrolled, endpoint: "/sign-out", jsonFields: {} });
  return { authenticator, client: yield* pendingSecondFactor(audience, email) };
});

const absentFields = ({
  columns,
  fields,
  model,
}: {
  readonly columns: readonly string[];
  readonly fields: readonly string[];
  readonly model: string;
}): string[] => {
  return fields.filter((field) => !columns.includes(field)).map((field) => `${model}.${field}`);
};

const missingSchemaFields = Effect.fn("missingSchemaFields")(function* missingSchemaFields(
  audience: Application,
) {
  const betterAuthSchema = getSchema((yield* AuthApps)[audience].instance.options);
  const columnsByModel = getSchemaShape();
  return Object.entries(betterAuthSchema).flatMap(([model, description]) =>
    absentFields({
      columns: columnsByModel[model] ?? [],
      fields: Object.keys(description.fields),
      model,
    }),
  );
});

const audienceInputs = Effect.fn("audienceInputs")(function* audienceInputs(audience: Application) {
  const { passkey, verification } = getSchema((yield* AuthApps)[audience].instance.options);
  return [passkey?.fields["audience"]?.input, verification?.fields["audience"]?.input];
});

const topPermission: Readonly<Record<Role, AccountPermission | null>> = {
  [ROLE.administrator]: ADMIN_PERMISSION.owner,
  [ROLE.member]: null,
  [ROLE.staff]: STAFF_PERMISSION.editor,
};

const assignRoleByEmail = Effect.fn("assignRoleByEmail")(function* assignRoleByEmail(
  email: string,
  role: Role,
) {
  yield* runStatement(
    "UPDATE user SET role = ?, permission = ? WHERE email = ?",
    role,
    topPermission[role],
    email,
  );
});

const assignRoleById = Effect.fn("assignRoleById")(function* assignRoleById(
  userId: string,
  role: Role,
) {
  yield* runStatement(
    "UPDATE user SET role = ?, permission = ? WHERE id = ?",
    role,
    topPermission[role],
    userId,
  );
});

const signedSessionCookie = Effect.fn("signedSessionCookie")(function* signedSessionCookie(
  token: string,
) {
  const { instance } = yield* Auth;
  const cookiePrefix = instance.options.advanced?.cookiePrefix;
  const secret = instance.options.secret;
  if (typeof cookiePrefix !== "string" || typeof secret !== "string") {
    return yield* new SessionRequired();
  }
  const signature = yield* Effect.promise(async () => makeSignature(token, secret));
  return `${cookiePrefix}.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
});

export {
  AuthApps,
  assignRoleByEmail,
  assignRoleById,
  PASSWORD,
  audienceInputs,
  audienceOnEmptyDatabase,
  authTest,
  authTestSecret,
  bootstrapVerifiedAdmin,
  bootstrapVerifiedStaff,
  clientOf,
  enableTotp,
  missingSchemaFields,
  pendingSecondFactor,
  register,
  registerVerified,
  requireStatus,
  runWith,
  sessionBeforeEnrollment,
  signIn,
  signInAgainAfterTotp,
  signInAs,
  signedSessionCookie,
  spendSignInWindow,
  verifyEmail,
  withAuth,
};
