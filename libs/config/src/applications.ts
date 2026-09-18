const WIKI_PORT = 3003;
const STORYBOOK_PORT = 3051;

const applications = ["user", "admin", "wiki"] as const;
type Application = (typeof applications)[number];
const USER_PORT = 3001;

const ADMIN_PORT = 3002;

const applicationPorts: Readonly<Record<Application, number>> = {
  admin: ADMIN_PORT,
  user: USER_PORT,
  wiki: WIKI_PORT,
};
const capabilities = ["ai"] as const;
type Capability = (typeof capabilities)[number];
const applicationCapabilities = {
  admin: [],
  user: ["ai"],
  wiki: ["ai"],
} as const satisfies Readonly<Record<Application, readonly Capability[]>>;

type CapabilityOf<App extends Application> = (typeof applicationCapabilities)[App][number];

const roles = ["user", "admin"] as const;
type Role = (typeof roles)[number];
const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];
const authenticationMethods = ["password", ...strongAuthenticationMethods, "recovery"] as const;
const loopbackHosts: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];
const storybookPort = STORYBOOK_PORT;

const grants = (app: Application, capability: Capability): boolean => {
  const granted: readonly Capability[] = applicationCapabilities[app];
  return granted.includes(capability);
};

export {
  applicationPorts,
  applications,
  authenticationMethods,
  grants,
  loopbackHosts,
  roles,
  storybookPort,
  strongAuthenticationMethods,
};
export type { Application, Capability, CapabilityOf, Role, StrongAuthenticationMethod };
