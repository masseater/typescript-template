import type { Audience, Database, DatabaseOperation } from "@template/db";
import { BrowserClient, HTTP_FOUND, PASSWORD } from "./browser-client.ts";
import { HttpResponse, http } from "msw";
import { test as baseTest, expect } from "vite-plus/test";
import { createAuth, verifySession } from "./index.ts";
import type { Auth } from "./index.ts";
import type { TestAPI } from "vite-plus/test";
import { createDb } from "@template/db";
import { sendVerificationEmail } from "@template/config";
import { setupServer } from "msw/node";

interface TestDatabase {
  readonly binding: Parameters<typeof createDb>[0];
  readonly dispose: () => Promise<void>;
}

interface AuthTestDependencies {
  readonly bootstrapAdmin: (database: Database, address: string) => Promise<unknown>;
  readonly createTestDatabase: () => Promise<TestDatabase>;
}

interface RecordedQuery {
  readonly duration: number;
  readonly operation: DatabaseOperation;
}

interface MailpitMessage {
  From: { Email: string };
  To: { Email: string }[];
  Subject: string;
  Text: string;
}

interface VerifyRequest {
  readonly allowEnrollment?: boolean;
  readonly audience: Audience;
  readonly headers: Headers;
}

interface AuthFixture {
  readonly adminAuth: Auth;
  readonly database: Database;
  readonly queries: readonly RecordedQuery[];
  readonly userAuth: Auth;
  readonly client: (audience: Audience) => BrowserClient;
  readonly register: (email: string) => Promise<BrowserClient>;
  readonly registerAdmin: (email: string) => Promise<BrowserClient>;
  readonly registerVerified: (email: string) => Promise<BrowserClient>;
  readonly verify: (request: VerifyRequest) => ReturnType<typeof verifySession>;
  readonly verifyEmail: (email: string) => Promise<void>;
}

interface FixtureScope {
  readonly auths: Readonly<Record<Audience, Auth>>;
  readonly database: Database;
  readonly dependencies: AuthTestDependencies;
  readonly mailbox: ReadonlyMap<string, string>;
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

function recordMail(mailbox: Map<string, string>, message: MailpitMessage): Response {
  if (message.From.Email !== MAIL_CONFIG.EMAIL_FROM || message.Subject !== "メールアドレスの確認") {
    return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  const url = message.Text.split("\n").find((line) => line.startsWith("http://"));
  if (url === undefined) {
    return HttpResponse.json({ error: "VERIFICATION_URL_REQUIRED" }, { status: 400 });
  }
  for (const recipient of message.To) {
    mailbox.set(recipient.Email, url);
  }
  return HttpResponse.json({ ID: crypto.randomUUID() });
}

function startMailServer(mailbox: Map<string, string>): ReturnType<typeof setupServer> {
  const server = setupServer(
    http.post<never, MailpitMessage>(
      `${MAIL_CONFIG.MAILPIT_URL}/api/v1/send`,
      async ({ request }) => recordMail(mailbox, await request.json()),
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

async function verifyEmailOf(scope: FixtureScope, email: string): Promise<void> {
  const url = scope.mailbox.get(email);
  if (url === undefined) {
    throw new Error("MAIL_DELIVERY_INVALID");
  }
  expect(new URL(url).searchParams.get("callbackURL")).toBe("/login");
  const response = await scope.auths.user.handler(new Request(url));
  if (!response.ok && response.status !== HTTP_FOUND) {
    throw new Error(`Verification failed: ${response.status}`);
  }
}

async function registerUser(scope: FixtureScope, email: string): Promise<BrowserClient> {
  const client = new BrowserClient(scope.auths.user, ORIGINS.user);
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

async function registerVerifiedUser(scope: FixtureScope, email: string): Promise<BrowserClient> {
  const client = await registerUser(scope, email);
  await verifyEmailOf(scope, email);
  return client;
}

function createFixture(scope: FixtureScope, queries: readonly RecordedQuery[]): AuthFixture {
  const { auths, database } = scope;
  return {
    adminAuth: auths.admin,
    client: (audience) => new BrowserClient(auths[audience], ORIGINS[audience]),
    database,
    queries,
    register: async (email) => registerUser(scope, email),
    registerAdmin: async (email) => {
      const client = await registerVerifiedUser(scope, email);
      await scope.dependencies.bootstrapAdmin(database, email);
      return client;
    },
    registerVerified: async (email) => registerVerifiedUser(scope, email),
    userAuth: auths.user,
    verify: async ({ allowEnrollment, audience, headers }) =>
      verifySession({
        audience,
        auth: auths[audience],
        database,
        headers,
        ...(allowEnrollment === undefined ? {} : { allowEnrollment }),
      }),
    verifyEmail: async (email) => verifyEmailOf(scope, email),
  };
}

function createAuthTest(dependencies: AuthTestDependencies): TestAPI<{ fixture: AuthFixture }> {
  return baseTest.extend<{ fixture: AuthFixture }>({
    fixture: async ({}, provide) => {
      const testDatabase = await dependencies.createTestDatabase();
      const { database, queries } = createTracedDatabase(testDatabase.binding);
      const mailbox = new Map<string, string>();
      const mailServer = startMailServer(mailbox);
      const auths = {
        admin: createAudienceAuth(database, "admin"),
        user: createAudienceAuth(database, "user"),
      };
      try {
        await provide(createFixture({ auths, database, dependencies, mailbox }, queries));
      } finally {
        mailServer.close();
        await testDatabase.dispose();
      }
    },
  });
}

export { createAuthTest };
export type { AuthFixture };
