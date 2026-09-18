export const applications = ["user", "admin", "wiki"] as const;
export type Application = (typeof applications)[number];

const USER_PORT = 3001;
const ADMIN_PORT = 3002;
const WIKI_PORT = 3003;
export const applicationPorts: Readonly<Record<Application, number>> = {
  admin: ADMIN_PORT,
  user: USER_PORT,
  wiki: WIKI_PORT,
};

const capabilities = ["ai"] as const;
export type Capability = (typeof capabilities)[number];
const applicationCapabilities = {
  admin: [],
  user: ["ai"],
  wiki: ["ai"],
} as const satisfies Readonly<Record<Application, readonly Capability[]>>;

export type CapabilityOf<App extends Application> = (typeof applicationCapabilities)[App][number];

export const grants = (app: Application, capability: Capability): boolean => {
  const granted: readonly Capability[] = applicationCapabilities[app];
  return granted.includes(capability);
};

export const roles = ["user", "admin"] as const;
export type Role = (typeof roles)[number];
export const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
export type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];
export const authenticationMethods = [
  "password",
  ...strongAuthenticationMethods,
  "recovery",
] as const;
export const loopbackHosts: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

const STORYBOOK_PORT = 3051;
export const storybookPort = STORYBOOK_PORT;
