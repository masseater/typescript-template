/** @canonical-values config.application */
export const applications = ["user", "admin", "wiki"] as const;
export const APPLICATION = {
  user: applications[0],
  admin: applications[1],
  wiki: applications[2],
} as const;

const USER_PORT = 3001;
const ADMIN_PORT = 3002;
const WIKI_PORT = 3003;
export type Application = (typeof applications)[number];
export type ServiceName = Application | "commander";
export const applicationPorts: Readonly<Record<Application, number>> = {
  admin: ADMIN_PORT,
  user: USER_PORT,
  wiki: WIKI_PORT,
};
export const applicationReadyPaths: Readonly<Record<Application, string>> = {
  admin: "/login",
  user: "/login",
  wiki: "/login",
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

/** @canonical-values config.role */
export const roles = ["user", "admin"] as const;
export type Role = (typeof roles)[number];
export const ROLE = { member: roles[0], administrator: roles[1] } as const;

/** @canonical-values config.strong-authentication-method */
export const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
export type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];

/** @canonical-values config.authentication-method */
export const authenticationMethods = [
  "password",
  ...strongAuthenticationMethods,
  "recovery",
] as const;
export type AuthenticationMethod = (typeof authenticationMethods)[number];
export const AUTHENTICATION_METHOD = {
  password: authenticationMethods[0],
  passwordTotp: authenticationMethods[1],
  passkey: authenticationMethods[2],
  recovery: authenticationMethods[3],
} as const;

export const loopbackAddress = "127.0.0.1";
export const loopbackHosts: readonly string[] = ["localhost", loopbackAddress, "[::1]"];
export const loopbackHostSet: ReadonlySet<string> = new Set(loopbackHosts);

export const loopbackOrigin = (listeningPort: number): string =>
  `http://${loopbackAddress}:${listeningPort}`;

export const applicationOrigins: Readonly<Record<Application, string>> = {
  admin: loopbackOrigin(ADMIN_PORT),
  user: loopbackOrigin(USER_PORT),
  wiki: loopbackOrigin(WIKI_PORT),
};

const STORYBOOK_PORT = 3051;
export const storybookPort = STORYBOOK_PORT;
export const storybookOrigin = `http://localhost:${STORYBOOK_PORT}`;

const MAILPIT_PORT = 8025;
export const mailpitPort = MAILPIT_PORT;
export const mailpitOrigin = loopbackOrigin(MAILPIT_PORT);
