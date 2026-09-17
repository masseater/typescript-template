import type { Application, Role } from "@template/config";
import { BrowserClient, PASSWORD } from "./browser-client.ts";
import { HttpResponse, http } from "msw";
import { test as baseTest, expect } from "vite-plus/test";
import { createAuth, verifySession } from "./index.ts";
import type { Auth } from "./index.ts";
import type { Database } from "@template/db";
import type { StrictRequest } from "msw";
import type { TestAPI } from "vite-plus/test";
import { authorizeMcpRequest } from "./mcp.ts";
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

interface MailpitMessage {
  readonly From: Readonly<{ Email: string }>;
  readonly To: readonly Readonly<{ Email: string }>[];
  readonly Subject: string;
  readonly Text: string;
}

interface VerifyRequest {
  readonly allowEnrollment?: boolean;
  readonly audience: Application;
  readonly headers: Readonly<Headers>;
}

interface AuthFixture {
  readonly setUserRole: (
    input: Readonly<{ role: Role; sessionId: string; targetId: string }>,
  ) => Promise<unknown>;
  readonly auth: (audience: Application) => Auth;
  readonly authOptions: (audience: Application) => Auth["options"];
  readonly authorizeMcp: (token?: string) => ReturnType<typeof authorizeMcpRequest>;
  readonly changeRole: (email: string, role: Role) => Promise<void>;
  readonly client: (audience: Application) => BrowserClient;
  readonly forgetMail: (email: string) => void;
  readonly hasMail: (email: string) => boolean;
  readonly origin: (audience: Application) => string;
  readonly register: (email: string) => Promise<BrowserClient>;
  readonly registerAdmin: (email: string) => Promise<BrowserClient>;
  readonly registerVerified: (email: string) => Promise<BrowserClient>;
  readonly verify: (request: VerifyRequest) => ReturnType<typeof verifySession>;
  readonly verifyEmail: (email: string) => Promise<void>;
}

interface MailScope {
  readonly userAuth: Readonly<Pick<Auth, "handler">>;
  readonly verificationUrl: (email: string) => string | undefined;
  readonly verifyToken: (token: string) => Promise<unknown>;
}

interface FixtureScope {
  readonly auths: Readonly<Record<Application, Auth>>;
  readonly database: Database;
  readonly dependencies: AuthTestDependencies;
  readonly mailbox: Map<string, string>;
}

const SECRET = "integration-test-secret-at-least-32-characters-long";
const MAIL_CONFIG = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};
const ORIGINS = {
  admin: "http://localhost:4102",
  user: "http://localhost:4101",
  wiki: "http://localhost:4103",
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createAudienceAuth(database: Database, audience: Application): Auth {
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
  const link = new URL(url);
  expect(link.pathname).toBe("/verify-email");
  expect(link.search).toBe("");
  const token = new URLSearchParams(link.hash.slice(1)).get("token");
  if (token === null) {
    throw new Error("VERIFICATION_TOKEN_MISSING");
  }
  await scope.verifyToken(token);
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

async function authorizeMcp(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  { auths, database }: FixtureScope,
  token: string | undefined,
): ReturnType<typeof authorizeMcpRequest> {
  return authorizeMcpRequest({
    auth: auths.wiki,
    database,
    origin: ORIGINS.wiki,
    request: new Request(`${ORIGINS.wiki}/mcp`, {
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      method: "POST",
    }),
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createFixture(scope: FixtureScope): AuthFixture {
  const { auths, database, mailbox } = scope;
  const mail = {
    userAuth: auths.user,
    verificationUrl: (email: string): string | undefined => mailbox.get(email),
    verifyToken: async (token: string): Promise<unknown> =>
      auths.user.api.verifyEmail({ query: { token } }),
  };
  return {
    auth: (audience) => auths[audience],
    authOptions: (audience) => auths[audience].options,
    authorizeMcp: async (token) => authorizeMcp(scope, token),
    changeRole: async (email, role) => {
      const context = await auths.wiki.$context;
      await context.internalAdapter.updateUserByEmail(email, { role });
    },
    client: (audience) => new BrowserClient(auths[audience], ORIGINS[audience]),
    forgetMail: (email) => {
      mailbox.delete(email);
    },
    hasMail: (email) => mailbox.has(email),
    origin: (audience) => ORIGINS[audience],
    register: async (email) => registerUser(auths.user, email),
    registerAdmin: async (email) => {
      const client = await registerVerifiedUser(mail, email);
      await scope.dependencies.bootstrapAdmin(database, email);
      return client;
    },
    registerVerified: async (email) => registerVerifiedUser(mail, email),
    setUserRole: async (input) => scope.dependencies.setUserRole({ ...input, database }),
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
      const database = createDb(testDatabase.binding);
      const mailbox = new Map<string, string>();
      const mailServer = startMailServer((email, url) => {
        mailbox.set(email, url);
      });
      const auths = {
        admin: createAudienceAuth(database, "admin"),
        user: createAudienceAuth(database, "user"),
        wiki: createAudienceAuth(database, "wiki"),
      };
      await auths.wiki.$context;
      try {
        await provide(createFixture({ auths, database, dependencies, mailbox }));
      } finally {
        mailServer.close();
        await testDatabase.dispose();
      }
    },
  });
}

export { createAuthTest };
export type { AuthFixture };
