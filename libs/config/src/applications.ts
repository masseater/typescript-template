import { Schema } from "effect";

const USER_PORT = 3001;
const ADMIN_PORT = 3002;
const WIKI_PORT = 3003;
const STORYBOOK_PORT = 3051;
const MAILPIT_PORT = 8025;

const applications = ["user", "admin", "wiki"] as const;
const ApplicationName = Schema.Literals(applications);
type Application = (typeof applications)[number];
const applicationPorts: Readonly<Record<Application, number>> = {
  admin: ADMIN_PORT,
  user: USER_PORT,
  wiki: WIKI_PORT,
};
const applicationReadyPaths: Readonly<Record<Application, string>> = {
  admin: "/login",
  user: "/login",
  wiki: "/login",
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

const loopbackAddress = "127.0.0.1";
const loopbackHosts: readonly string[] = ["localhost", loopbackAddress, "[::1]"];
const storybookPort = STORYBOOK_PORT;
const mailpitPort = MAILPIT_PORT;

function loopbackOrigin(port: number): string {
  return `http://${loopbackAddress}:${port}`;
}

const applicationOrigins: Readonly<Record<Application, string>> = {
  admin: loopbackOrigin(ADMIN_PORT),
  user: loopbackOrigin(USER_PORT),
  wiki: loopbackOrigin(WIKI_PORT),
};
const mailpitOrigin = loopbackOrigin(MAILPIT_PORT);
const storybookOrigin = `http://localhost:${STORYBOOK_PORT}`;

export {
  ApplicationName,
  applicationOrigins,
  applicationPorts,
  applicationReadyPaths,
  applications,
  grants,
  loopbackAddress,
  loopbackHosts,
  loopbackOrigin,
  mailpitOrigin,
  mailpitPort,
  storybookOrigin,
  storybookPort,
};
export type { Application, Capability, CapabilityOf };
