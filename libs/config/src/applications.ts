const USER_PORT = 3001;
const ADMIN_PORT = 3002;
const WIKI_PORT = 3003;
const STORYBOOK_PORT = 3051;

const applications = ["user", "admin", "wiki"] as const;
type Application = (typeof applications)[number];
const applicationPorts: Readonly<Record<Application, number>> = {
  admin: ADMIN_PORT,
  user: USER_PORT,
  wiki: WIKI_PORT,
};
const roles = ["user", "admin"] as const;
type Role = (typeof roles)[number];
const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];
const authenticationMethods = ["password", ...strongAuthenticationMethods, "recovery"] as const;
const loopbackHosts: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];
const storybookPort = STORYBOOK_PORT;

export {
  applicationPorts,
  applications,
  authenticationMethods,
  loopbackHosts,
  roles,
  storybookPort,
  strongAuthenticationMethods,
};
export type { Application, Role, StrongAuthenticationMethod };
