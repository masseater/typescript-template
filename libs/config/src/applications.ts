const USER_PORT = 3001;
const ADMIN_PORT = 3002;
const WIKI_PORT = 3003;
const STORYBOOK_PORT = 3051;
const MAILPIT_PORT = 8025;

const applications = ["user", "admin", "wiki"] as const;
type Application = (typeof applications)[number];
const applicationPorts: Readonly<Record<Application, number>> = {
  admin: ADMIN_PORT,
  user: USER_PORT,
  wiki: WIKI_PORT,
};
const applicationReadyPaths: Readonly<Record<Application, string>> = {
  admin: "/login",
  user: "/login",
  wiki: "/",
};
const capabilities = ["ai"] as const;
type Capability = (typeof capabilities)[number];
const applicationCapabilities = {
  admin: [],
  user: ["ai"],
  wiki: ["ai"],
} as const satisfies Readonly<Record<Application, readonly Capability[]>>;

type CapabilityOf<App extends Application> = (typeof applicationCapabilities)[App][number];

function grants(app: Application, capability: Capability): boolean {
  const granted: readonly Capability[] = applicationCapabilities[app];
  return granted.includes(capability);
}

const roles = ["user", "admin"] as const;
type Role = (typeof roles)[number];
const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];
const authenticationMethods = ["password", ...strongAuthenticationMethods, "recovery"] as const;
const loopbackHosts: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];
const storybookPort = STORYBOOK_PORT;
const mailpitPort = MAILPIT_PORT;

export {
  applicationPorts,
  applicationReadyPaths,
  applications,
  authenticationMethods,
  grants,
  loopbackHosts,
  mailpitPort,
  roles,
  storybookPort,
  strongAuthenticationMethods,
};
export type { Application, Capability, CapabilityOf, Role, StrongAuthenticationMethod };
