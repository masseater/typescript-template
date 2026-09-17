import type { Audience, Database, DatabaseOperation, Role } from "@template/db";
import { BrowserClient, HTTP_FOUND, PASSWORD } from "./browser-client.ts";
import { HttpResponse, http } from "msw";
import { test as baseTest, expect } from "vite-plus/test";
import { createAuth, verifySession } from "./index.ts";
import type { Auth } from "./index.ts";
import type { StrictRequest } from "msw";
import type { TestAPI } from "vite-plus/test";
import { createDb } from "@template/db";
import { sendVerificationEmail } from "@template/config";
import { setupServer } from "msw/node";

interface TestDatabase {
  readonly binding: Parameters<typeof createDb>[0];
  readonly dispose: () => Promise<void>;
}

interface AuthTestDependencies {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly bootstrapAdmin: (database: Database, address: string) => Promise<unknown>;
  readonly createTestDatabase: () => Promise<TestDatabase>;
  readonly setUserRole: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    input: Readonly<{ database: Database; role: Role; sessionId: string; targetId: string }>,
  ) => Promise<unknown>;
}

interface RecordedQuery {
  readonly duration: number;
  readonly operation: DatabaseOperation;
}

interface MailpitMessage {
  readonly From: Readonly<{ Email: string }>;
  readonly To: readonly Readonly<{ Email: string }>[];
  readonly Subject: string;
  readonly Text: string;
}

interface VerifyRequest {
  readonly allowEnrollment?: boolean;
  readonly audience: Audience;
  readonly headers: Readonly<Headers>;
}

interface AuthFixture {
  readonly queries: readonly RecordedQuery[];
  readonly setUserRole: (
    input: Readonly<{ role: Role; sessionId: string; targetId: string }>,
  ) => Promise<unknown>;
  readonly userAuthOptions: () => Auth["options"];
  readonly client: (audience: Audience) => BrowserClient;
  readonly register: (email: string) => Promise<BrowserClient>;
  readonly registerAdmin: (email: string) => Promise<BrowserClient>;
  readonly registerVerified: (email: string) => Promise<BrowserClient>;
  readonly verify: (request: VerifyRequest) => ReturnType<typeof verifySession>;
  readonly verifyEmail: (email: string) => Promise<void>;
}

interface MailScope {
  readonly userAuth: Readonly<Pick<Auth, "handler">>;
  readonly verificationUrl: (email: string) => string | undefined;
}

interface FixtureScope {
  readonly auths: Readonly<Record<Audience, Auth>>;
  readonly database: Database;
  readonly dependencies: AuthTestDependencies;
  readonly verificationUrl: (email: string) => string | undefined;
}

const SECRET = "integration-test-secret-at-least-32-characters-long";
const MAIL_CONFIG = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};
const ORIGINS = {
  admin: "http://localhost:4102",
  user: "http://localhost:4101",
} as const;

function recordMail(
  deliver: (email: string, url: string) => void,
  message: MailpitMessage,
): Response {
  if (message.From.Email !== MAIL_CONFIG.EMAIL_FROM || message.Subject !== "メールアドレスの確認") {
    return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  const url = message.Text.split("\n").find((line) => line.startsWith("http://"));
  if (url === undefined) {
    return HttpResponse.json({ error: "VERIFICATION_URL_REQUIRED" }, { status: 400 });
  }
  for (const recipient of message.To) {
    deliver(recipient.Email, url);
  }
  return HttpResponse.json({ ID: crypto.randomUUID() });
}

function startMailServer(
  deliver: (email: string, url: string) => void,
): ReturnType<typeof setupServer> {
  const server = setupServer(
    http.post<never, MailpitMessage>(
      `${MAIL_CONFIG.MAILPIT_URL}/api/v1/send`,
      async ({
        request,
      }: Readonly<{ request: Readonly<Pick<StrictRequest<MailpitMessage>, "json">> }>) =>
        recordMail(deliver, await request.json()),
    ),
  );
  server.listen({ onUnhandledRequest: "error" });
  return server;
}

function createTracedDatabase(binding: TestDatabase["binding"]): {
  database: Database;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  async function trace<Result>(
    operation: DatabaseOperation,
    execute: () => Promise<Result>,
  ): Promise<Result> {
    const started = performance.now();
    const result = await execute();
    queries.push({ duration: performance.now() - started, operation });
    return result;
  }
  return { database: createDb(binding, trace), queries };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createAudienceAuth(database: Database, audience: Audience): Auth {
  return createAuth({
    audience,
    baseURL: ORIGINS[audience],
    database,
    secret: SECRET,
    sendVerificationEmail: async (message) => {
      await sendVerificationEmail({ ...MAIL_CONFIG, APP_ORIGIN: ORIGINS[audience] }, message);
    },
  });
}

async function verifyEmailOf(scope: MailScope, email: string): Promise<void> {
  const url = scope.verificationUrl(email);
  if (url === undefined) {
    throw new Error("MAIL_DELIVERY_INVALID");
  }
  expect(new URL(url).searchParams.get("callbackURL")).toBe("/login");
  const response = await scope.userAuth.handler(new Request(url));
  if (!response.ok && response.status !== HTTP_FOUND) {
    throw new Error(`Verification failed: ${response.status}`);
  }
}

async function registerUser(
  userAuth: Readonly<Pick<Auth, "handler">>,
  email: string,
): Promise<BrowserClient> {
  const client = new BrowserClient(userAuth, ORIGINS.user);
  const response = await client.request("/sign-up/email", {
    email,
    name: email,
    password: PASSWORD,
  });
  if (!response.ok) {
    throw new Error(`Registration failed: ${response.status}`);
  }
  return client;
}

async function registerVerifiedUser(scope: MailScope, email: string): Promise<BrowserClient> {
  const client = await registerUser(scope.userAuth, email);
  await verifyEmailOf(scope, email);
  return client;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createFixture(scope: FixtureScope, queries: readonly RecordedQuery[]): AuthFixture {
  const { auths, database, verificationUrl } = scope;
  const mail = { userAuth: auths.user, verificationUrl };
  return {
    client: (audience) => new BrowserClient(auths[audience], ORIGINS[audience]),
    queries,
    register: async (email) => registerUser(auths.user, email),
    registerAdmin: async (email) => {
      const client = await registerVerifiedUser(mail, email);
      await scope.dependencies.bootstrapAdmin(database, email);
      return client;
    },
    registerVerified: async (email) => registerVerifiedUser(mail, email),
    setUserRole: async (input) => scope.dependencies.setUserRole({ ...input, database }),
    userAuthOptions: () => auths.user.options,
    verify: async ({ allowEnrollment, audience, headers }) =>
      verifySession({
        audience,
        auth: auths[audience],
        database,
        headers,
        ...(allowEnrollment === undefined ? {} : { allowEnrollment }),
      }),
    verifyEmail: async (email) => verifyEmailOf(mail, email),
  };
}

function createAuthTest(dependencies: AuthTestDependencies): TestAPI<{ fixture: AuthFixture }> {
  return baseTest.extend<{ fixture: AuthFixture }>({
    fixture: async ({}: object, provide) => {
      const testDatabase = await dependencies.createTestDatabase();
      const { database, queries } = createTracedDatabase(testDatabase.binding);
      const mailbox = new Map<string, string>();
      const mailServer = startMailServer((email, url) => {
        mailbox.set(email, url);
      });
      const auths = {
        admin: createAudienceAuth(database, "admin"),
        user: createAudienceAuth(database, "user"),
      };
      try {
        await provide(
          createFixture(
            { auths, database, dependencies, verificationUrl: (email) => mailbox.get(email) },
            queries,
          ),
        );
      } finally {
        mailServer.close();
        await testDatabase.dispose();
      }
    },
  });
}

export { createAuthTest };
export type { AuthFixture };
