import { env } from "cloudflare:workers";

const fixtureOrigin = "http://localhost:3001";
const fixtureAuthSecret = "worker-test-secret-at-least-32-characters";

function appEnvironment(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...env,
    APP_ORIGIN: fixtureOrigin,
    APP_RELEASE: "test",
    ASSETS: { fetch: async (): Promise<Response> => new Response(undefined) },
    AUTH_SECRET: fixtureAuthSecret,
    EMAIL_FROM: "sender@example.test",
    ...overrides,
  };
}

export { appEnvironment, fixtureAuthSecret, fixtureOrigin };
